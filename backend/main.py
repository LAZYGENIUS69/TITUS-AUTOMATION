import os
import json
import asyncio
from pathlib import Path
import pandas as pd
from typing import List, Dict, Any
from fastapi import FastAPI, Depends, UploadFile, File, Form, HTTPException, BackgroundTasks, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import text
from dotenv import load_dotenv

# Load env variables from the backend's own .env, independent of the process cwd.
ENV_FILE = Path(__file__).with_name(".env")
load_dotenv(dotenv_path=ENV_FILE, override=True)

import models
import schemas
import crud
from database import engine, Base, get_db, SessionLocal
from pdf_generator import overlay_text_and_generate_pdf
from email_sender import send_email_with_retry, PROVIDER
import auth

# Create upload paths
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
TEMPLATES_DIR = os.path.join(UPLOAD_DIR, "templates")
EXCELS_DIR = os.path.join(UPLOAD_DIR, "excels")
PDFS_DIR = os.path.join(UPLOAD_DIR, "pdfs")
FONTS_DIR = os.path.join(os.path.dirname(__file__), "fonts")

for d in [TEMPLATES_DIR, EXCELS_DIR, PDFS_DIR, FONTS_DIR]:
    os.makedirs(d, exist_ok=True)

def resolve_db_template_path(template_path: str) -> str:
    if not template_path:
        return ""
    if os.path.isabs(template_path):
        return template_path
    
    # If it is an old URL-relative path starting with static/templates/
    if template_path.startswith("static/templates/"):
        filename = template_path.replace("static/templates/", "")
        return os.path.join(TEMPLATES_DIR, filename)
    
    # Fallback to resolving relative to the parent directory of main.py
    base_dir = os.path.dirname(os.path.dirname(__file__))
    return os.path.join(base_dir, template_path.replace("/", os.sep))

# Initialize database (create tables for new models)
Base.metadata.create_all(bind=engine)

# ── Startup migration: add new columns to event_fields if they don't exist ────
# SQLite does not add columns automatically when the schema changes.
# We check for each new column and ALTER TABLE only if missing.
def _run_migrations():
    _NEW_COLUMNS = [
        ("width",         "INTEGER DEFAULT 400"),
        ("height",        "INTEGER DEFAULT 60"),
        ("format_type",   "VARCHAR DEFAULT 'as_is'"),
        ("format_config", "TEXT"),
        ("font_filename", "VARCHAR DEFAULT NULL"),
        ("vertical_offset", "INTEGER DEFAULT 0"),
    ]
    with engine.connect() as conn:
        # Get existing columns
        result = conn.execute(text("PRAGMA table_info(event_fields)"))
        existing = {row[1] for row in result.fetchall()}
        for col_name, col_def in _NEW_COLUMNS:
            if col_name not in existing:
                conn.execute(text(f"ALTER TABLE event_fields ADD COLUMN {col_name} {col_def}"))
                print(f"[migration] Added column '{col_name}' to event_fields")
        conn.commit()

_run_migrations()

app = FastAPI(title="Certificate Automation API")


@app.middleware("http")
async def require_authentication(request: Request, call_next):
    path = request.url.path
    public_paths = {"/api/auth/login", "/api/auth/register", "/docs", "/openapi.json", "/redoc"}
    if request.method == "OPTIONS" or path in public_paths:
        return await call_next(request)

    authorization = request.headers.get("Authorization", "")
    token = authorization[7:].strip() if authorization.lower().startswith("bearer ") else request.query_params.get("token", "")
    if not token:
        return JSONResponse(status_code=401, content={"detail": "Authentication required"})

    with SessionLocal() as auth_db:
        user = auth.get_user_from_token(auth_db, token)
    if not user:
        return JSONResponse(status_code=401, content={"detail": "Invalid or expired authentication token"})

    request.state.user = user
    return await call_next(request)


@app.post("/api/auth/register", response_model=schemas.AuthResponse)
def register(credentials: schemas.AuthCredentials, db: Session = Depends(get_db)):
    email = auth.normalize_email(credentials.email)
    if len(credentials.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Enter a valid email address")
    if db.query(models.User).filter(models.User.email == email).first():
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    role = "admin" if db.query(models.User).count() == 0 else "member"
    user = models.User(email=email, password_hash=auth.hash_password(credentials.password), role=role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return schemas.AuthResponse(
        access_token=auth.create_access_token(user),
        user=schemas.AuthUser(id=user.id, email=user.email, role=user.role),
    )


@app.post("/api/auth/login", response_model=schemas.AuthResponse)
def login(credentials: schemas.AuthCredentials, db: Session = Depends(get_db)):
    email = auth.normalize_email(credentials.email)
    user = db.query(models.User).filter(models.User.email == email).first()
    if not user or not auth.verify_password(credentials.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    return schemas.AuthResponse(
        access_token=auth.create_access_token(user),
        user=schemas.AuthUser(id=user.id, email=user.email, role=user.role),
    )


@app.get("/api/auth/me", response_model=schemas.AuthUser)
def current_user(request: Request):
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return schemas.AuthUser(id=user.id, email=user.email, role=user.role)

# Enable CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded templates and generated PDFs statically so client can view/preview them
app.mount("/static/templates", StaticFiles(directory=TEMPLATES_DIR), name="templates")
app.mount("/static/pdfs", StaticFiles(directory=PDFS_DIR), name="pdfs")

# Semaphores for concurrency limiting
pdf_semaphore = asyncio.Semaphore(5)
email_semaphore = asyncio.Semaphore(5)


# --- EVENT ENDPOINTS ---

@app.post("/api/events", response_model=schemas.Event)
async def create_event(
    name: str = Form(...),
    template: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    # Save the template image
    filename = f"{int(asyncio.get_event_loop().time())}_{template.filename}"
    template_path = os.path.join(TEMPLATES_DIR, filename)

    try:
        with open(template_path, "wb") as buffer:
            content = await template.read()
            buffer.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save template image: {str(e)}")

    event_in = schemas.EventCreate(name=name)
    abs_template_path = str((Path(TEMPLATES_DIR) / filename).resolve())
    db_event = crud.create_event(db, event_in, template_path=abs_template_path)
    schema = schemas.Event.model_validate(db_event)
    schema.template_missing = False
    return schema

@app.get("/api/events", response_model=List[schemas.Event])
def list_events(db: Session = Depends(get_db)):
    events = crud.get_events(db)
    result = []
    for e in events:
        schema = schemas.Event.model_validate(e)
        schema.template_missing = not os.path.exists(resolve_db_template_path(e.template_path))
        result.append(schema)
    return result

@app.get("/api/events/{event_id}", response_model=schemas.Event)
def get_event(event_id: int, db: Session = Depends(get_db)):
    event = crud.get_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    schema = schemas.Event.model_validate(event)
    schema.template_missing = not os.path.exists(resolve_db_template_path(event.template_path))
    return schema

@app.get("/api/events/{event_id}/template-image")
def get_event_template_image(event_id: int, db: Session = Depends(get_db)):
    event = crud.get_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    resolved_path = resolve_db_template_path(event.template_path)
    if not resolved_path or not os.path.exists(resolved_path):
        raise HTTPException(status_code=404, detail="Template image file not found on disk")
    return FileResponse(resolved_path)

@app.delete("/api/events/{event_id}")
def delete_event(event_id: int, db: Session = Depends(get_db)):
    event = crud.get_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Try to delete template file
    if event.template_path:
        full_path = resolve_db_template_path(event.template_path)
        if full_path and os.path.exists(full_path):
            try:
                os.remove(full_path)
            except Exception:
                pass

    crud.delete_event(db, event_id)
    return {"message": "Event deleted successfully"}

@app.post("/api/events/{event_id}/fields", response_model=List[schemas.EventField])
def save_event_fields(
    event_id: int,
    fields: List[schemas.EventFieldCreate],
    db: Session = Depends(get_db)
):
    event = crud.get_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return crud.set_event_fields(db, event_id, fields)

@app.post("/api/events/{event_id}/preview")
async def generate_preview(
    event_id: int,
    request: schemas.PreviewRequest,
    db: Session = Depends(get_db)
):
    event = crud.get_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Construct dummy/test data based on fields and custom values
    preview_values = request.preview_values or {}
    dummy_data = {}
    for f in request.fields:
        if f.placeholder in preview_values and preview_values[f.placeholder].strip():
            dummy_data[f.placeholder] = preview_values[f.placeholder]
        else:
            fmt = f.format_type or "as_is"
            if fmt in ("roman_numeral", "ordinal"):
                dummy_data[f.placeholder] = "5"
            else:
                dummy_data[f.placeholder] = f"[Sample {f.placeholder}]"

    # Resolve the template path safely
    full_template_path = resolve_db_template_path(event.template_path)

    preview_filename = f"preview_{event_id}_{int(asyncio.get_event_loop().time())}.pdf"
    preview_output_path = os.path.join(PDFS_DIR, "previews", preview_filename)
    os.makedirs(os.path.dirname(preview_output_path), exist_ok=True)

    fields_dict_list = [f.model_dump() for f in request.fields]

    try:
        # Run overlay in executor thread
        await asyncio.to_thread(
            overlay_text_and_generate_pdf,
            full_template_path,
            fields_dict_list,
            dummy_data,
            preview_output_path
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate preview PDF: {str(e)}")

    return {"preview_url": f"static/pdfs/previews/{preview_filename}"}


# --- FONTS ENDPOINTS ---

def _get_fonts_list() -> List[str]:
    if not os.path.exists(FONTS_DIR):
        os.makedirs(FONTS_DIR, exist_ok=True)
    # Default system/hardcoded fonts are always options, plus files in fonts directory
    fonts = [f for f in os.listdir(FONTS_DIR) if f.lower().endswith((".ttf", ".otf"))]
    # Guarantee Roboto-Regular.ttf is listed or add fallback defaults
    if "Roboto-Regular.ttf" not in fonts:
        fonts.append("Roboto-Regular.ttf")
    if "arial.ttf" not in fonts:
        fonts.append("arial.ttf")
    return sorted(list(set(fonts)))

@app.get("/api/fonts", response_model=List[str])
def list_fonts():
    return _get_fonts_list()

@app.get("/api/fonts/file/{filename}")
def serve_font_file(filename: str):
    """Serve a font file so the browser can use it via @font-face."""
    # Sanitize: only allow filenames without path separators
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    font_path = os.path.join(FONTS_DIR, filename)
    if not os.path.exists(font_path):
        raise HTTPException(status_code=404, detail=f"Font file '{filename}' not found")
    ext = filename.lower().rsplit(".", 1)[-1]
    media_type = "font/otf" if ext == "otf" else "font/ttf"
    return FileResponse(font_path, media_type=media_type, headers={"Cache-Control": "public, max-age=86400"})

@app.post("/api/fonts", response_model=List[str])
async def upload_font(font_file: UploadFile = File(...)):
    if not font_file.filename.lower().endswith((".ttf", ".otf")):
        raise HTTPException(status_code=400, detail="Only TrueType (.ttf) or OpenType (.otf) font files are allowed.")
    
    font_path = os.path.join(FONTS_DIR, font_file.filename)
    try:
        with open(font_path, "wb") as buffer:
            content = await font_file.read()
            buffer.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save font file: {str(e)}")
        
    return _get_fonts_list()


# --- RUN ENDPOINTS ---

@app.post("/api/runs", response_model=schemas.Run)
async def create_run(
    event_id: int = Form(...),
    email_column: str = Form(...),
    excel_file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    event = crud.get_event(db, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    # Save uploaded Excel file
    filename = f"{int(asyncio.get_event_loop().time())}_{excel_file.filename}"
    excel_path = os.path.join(EXCELS_DIR, filename)

    try:
        with open(excel_path, "wb") as buffer:
            content = await excel_file.read()
            buffer.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not save Excel sheet: {str(e)}")

    # Parse Excel with pandas
    try:
        df = pd.read_excel(excel_path)
        # Fill NaN values with empty string and convert types
        df = df.fillna("")

        # Verify the Excel contains the mapped email column
        excel_cols = [str(c).strip().lower() for c in df.columns]
        normalized_email_col = email_column.strip().lower()
        if normalized_email_col not in excel_cols:
            # Try to delete file
            try:
                os.remove(excel_path)
            except Exception:
                pass
            raise HTTPException(
                status_code=400,
                detail=f"Email column '{email_column}' not found in Excel sheet. Available columns: {list(df.columns)}"
            )

        rows_data = df.to_dict(orient="records")
    except Exception as e:
        try:
            os.remove(excel_path)
        except Exception:
            pass
        raise HTTPException(status_code=400, detail=f"Could not parse Excel: {str(e)}")

    # Save Run object to DB
    run = crud.create_run(db, event_id=event_id, excel_filename=excel_file.filename, email_column=email_column)

    # Bulk insert rows
    crud.bulk_create_run_rows(db, run_id=run.id, rows_data=rows_data)

    return run

@app.get("/api/runs", response_model=List[schemas.Run])
def list_runs(db: Session = Depends(get_db)):
    return crud.get_runs(db)

@app.get("/api/runs/{run_id}/status", response_model=schemas.RunProgress)
def get_run_status(run_id: int, db: Session = Depends(get_db)):
    run = crud.get_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    # Get rows
    rows = run.rows
    total_rows = len(rows)

    pdf_generated = sum(1 for r in rows if r.pdf_path is not None)
    email_sent = sum(1 for r in rows if r.email_status == "sent")
    email_failed = sum(1 for r in rows if r.email_status == "failed")
    email_pending = sum(1 for r in rows if r.email_status in ("pending", "generating", "generated"))

    return schemas.RunProgress(
        id=run.id,
        event_id=run.event_id,
        status=run.status,
        excel_filename=run.excel_filename,
        total_rows=total_rows,
        pdf_generated=pdf_generated,
        email_sent=email_sent,
        email_failed=email_failed,
        email_pending=email_pending,
        rows=[schemas.RunRow.model_validate(r) for r in rows]
    )


# --- BACKGROUND WORKER LOGIC ---

def _field_to_dict(f) -> Dict[str, Any]:
    """Convert an EventField ORM object to a dict for the PDF renderer."""
    return {
        "placeholder": f.placeholder,
        "x": f.x,
        "y": f.y,
        "width": f.width if f.width is not None else 400,
        "height": f.height if f.height is not None else 60,
        "font_size": f.font_size,
        "font_path": f.font_path,
        "font_color": f.font_color,
        "format_type": f.format_type or "as_is",
        "format_config": f.format_config,
        "font_filename": f.font_filename,
        "vertical_offset": f.vertical_offset if f.vertical_offset is not None else 0,
    }


async def generate_pdfs_background(run_id: int):
    # Separate DB session for background thread
    db = SessionLocal()
    try:
        run = crud.get_run(db, run_id)
        if not run:
            return

        crud.update_run_status(db, run_id, "generating")
        event = run.event
        fields = [_field_to_dict(f) for f in event.fields]

        # Resolve the template path safely
        full_template_path = resolve_db_template_path(event.template_path)

        # Process all rows in the run to support re-generation/updates
        rows = run.rows

        async def process_row(row):
            async with pdf_semaphore:
                try:
                    # Update row to generating
                    crud.update_run_row_email(db, row.id, "generating")

                    row_data_dict = json.loads(row.row_data)
                    pdf_filename = f"cert_{run_id}_{row.id}.pdf"
                    pdf_output_path = os.path.join(PDFS_DIR, str(run_id), pdf_filename)

                    # Call CPU bound image drawing in thread pool
                    warnings = await asyncio.to_thread(
                        overlay_text_and_generate_pdf,
                        full_template_path,
                        fields,
                        row_data_dict,
                        pdf_output_path
                    )

                    relative_pdf_path = f"static/pdfs/{run_id}/{pdf_filename}"
                    # Persist any format warnings as a non-blocking note in email_error
                    warning_msg = ("\n".join(warnings)) if warnings else None
                    crud.update_run_row_pdf(db, row.id, relative_pdf_path, "generated")
                    if warning_msg:
                        # Write warning without changing the status to "failed"
                        db_row = crud.get_run_row(db, row.id)
                        if db_row:
                            db_row.email_error = warning_msg
                            db.commit()

                except Exception as e:
                    print(f"Error generating PDF for row {row.id}: {str(e)}")
                    crud.update_run_row_email(db, row.id, "failed", f"PDF Generation Error: {str(e)}")

        # Run tasks concurrently (limited by Semaphore)
        await asyncio.gather(*(process_row(r) for r in rows))

        # Recalculate status
        all_rows = crud.get_run(db, run_id).rows
        any_failed = any(r.email_status == "failed" and r.pdf_path is None for r in all_rows)

        if any_failed:
            crud.update_run_status(db, run_id, "failed")
        else:
            crud.update_run_status(db, run_id, "generated")

    finally:
        db.close()


async def send_emails_background(run_id: int):
    db = SessionLocal()
    try:
        run = crud.get_run(db, run_id)
        if not run:
            return

        crud.update_run_status(db, run_id, "sending")

        # Get rows that have generated PDFs and have not sent successfully yet
        rows = [r for r in run.rows if r.pdf_path and r.email_status in ("generated", "failed", "pending")]
        email_column = run.email_column

        async def process_email(row):
            async with email_semaphore:
                try:
                    # Update status to sending
                    crud.update_run_row_email(db, row.id, "sending")

                    row_data_dict = json.loads(row.row_data)
                    # Support case-insensitive email column matching
                    norm_email_col = email_column.lower().strip()
                    recipient_email = None
                    for k, v in row_data_dict.items():
                        if str(k).lower().strip() == norm_email_col:
                            recipient_email = str(v).strip()
                            break

                    if not recipient_email or "@" not in recipient_email:
                        crud.update_run_row_email(db, row.id, "failed", f"Invalid recipient email: '{recipient_email}'")
                        return

                    if row.pdf_path.startswith("static/pdfs/"):
                        rel_suffix = row.pdf_path.replace("static/pdfs/", "")
                        full_pdf_path = os.path.join(PDFS_DIR, rel_suffix.replace("/", os.sep))
                    else:
                        base_dir = os.path.dirname(os.path.dirname(__file__))
                        full_pdf_path = os.path.join(base_dir, row.pdf_path.replace("/", os.sep))

                    # Dispatch email with retry + backoff
                    success, message = await send_email_with_retry(
                        to_email=recipient_email,
                        pdf_path=full_pdf_path
                    )

                    if success:
                        crud.update_run_row_email(db, row.id, "sent", message)
                    else:
                        crud.update_run_row_email(db, row.id, "failed", message)

                except Exception as e:
                    print(f"Error sending email for row {row.id}: {str(e)}")
                    crud.update_run_row_email(db, row.id, "failed", f"Mailer Exception: {str(e)}")

        await asyncio.gather(*(process_email(r) for r in rows))

        # Recalculate status
        all_rows = crud.get_run(db, run_id).rows
        any_failed_emails = any(r.email_status == "failed" for r in all_rows)

        if any_failed_emails:
            crud.update_run_status(db, run_id, "failed")
        else:
            crud.update_run_status(db, run_id, "completed")

    finally:
        db.close()


@app.post("/api/runs/{run_id}/generate")
def start_pdf_generation(run_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    run = crud.get_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    if run.status == "generating":
        raise HTTPException(status_code=400, detail="Generation is already in progress")

    background_tasks.add_task(generate_pdfs_background, run_id)
    return {"message": "PDF generation triggered"}


@app.post("/api/runs/{run_id}/send")
def start_email_dispatch(run_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    run = crud.get_run(db, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    if run.status == "sending":
        raise HTTPException(status_code=400, detail="Email sending is already in progress")

    background_tasks.add_task(send_emails_background, run_id)
    return {"message": "Email sending triggered"}

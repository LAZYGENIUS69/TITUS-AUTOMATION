import os
import json
import asyncio
from PIL import Image
import pandas as pd

from database import SessionLocal, Base, engine
import models
import crud
import schemas
from pdf_generator import overlay_text_and_generate_pdf
from email_sender import send_email_with_retry

def setup_test_files():
    print("Setting up temporary test files...")
    # Create test canvas template (blank image 1200x800)
    template_path = "test_template.png"
    img = Image.new("RGB", (1200, 800), color="#2E3440")
    img.save(template_path)
    print(f"Created template at: {template_path}")

    # Create dummy Excel spreadsheet using pandas
    excel_path = "test_recipients.xlsx"
    data = [
        {"Full Name": "Alice Smith", "Role": "Lead Architect", "Email": "alice@example.com"},
        {"Full Name": "Bob Jones", "Role": "Backend Developer", "Email": "bob@example.com"},
        {"Full Name": "Charlie Brown", "Role": "UI/UX Designer", "Email": "charlie@example.com"},
    ]
    df = pd.DataFrame(data)
    df.to_excel(excel_path, index=False)
    print(f"Created Excel sheet at: {excel_path}")
    return template_path, excel_path, data

def test_database_and_generator(template_path, excel_path, test_data):
    print("\n--- Running CRUD and PDF generation tests ---")
    
    # Setup database tables
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    # 1. Create Event
    event_in = schemas.EventCreate(name="Test Bootcamp Event")
    event = crud.create_event(db, event_in, template_path=template_path)
    print(f"Created event in DB: ID={event.id}, Name={event.name}")
    
    # 2. Add Fields to Event
    fields_in = [
        schemas.EventFieldCreate(
            placeholder="Full Name",
            x=600,
            y=350,
            font_size=48,
            font_path="Roboto-Regular.ttf",
            font_color="#FFFFFF"
        ),
        schemas.EventFieldCreate(
            placeholder="Role",
            x=600,
            y=450,
            font_size=32,
            font_path="Roboto-Regular.ttf",
            font_color="#88C0D0"
        )
    ]
    fields = crud.set_event_fields(db, event.id, fields_in)
    print(f"Associated {len(fields)} fields with event ID {event.id}")
    
    # 3. Create Run
    run = crud.create_run(db, event_id=event.id, excel_filename="test_recipients.xlsx", email_column="Email")
    print(f"Created run: ID={run.id}, Status={run.status}, Email Column={run.email_column}")
    
    # 4. Add Rows
    rows = crud.bulk_create_run_rows(db, run_id=run.id, rows_data=test_data)
    print(f"Inserted {len(rows)} recipient rows for Run {run.id}")
    
    # 5. Generate PDF for first row manually
    row = rows[0]
    row_data = json.loads(row.row_data)
    output_pdf = f"test_output_{row.id}.pdf"
    
    fields_dict = [
        {
            "placeholder": f.placeholder,
            "x": f.x,
            "y": f.y,
            "width": f.width,
            "height": f.height,
            "font_size": f.font_size,
            "font_path": f.font_path,
            "font_color": f.font_color,
            "format_type": f.format_type,
            "format_config": f.format_config
        } for f in event.fields
    ]
    
    print(f"Overlaying text for {row_data['Full Name']}...")
    overlay_text_and_generate_pdf(
        template_path=template_path,
        fields=fields_dict,
        row_data=row_data,
        output_pdf_path=output_pdf
    )
    
    if os.path.exists(output_pdf):
        print(f"SUCCESS: Generated PDF at {output_pdf} (size: {os.path.getsize(output_pdf)} bytes)")
        os.remove(output_pdf)
    else:
        print("FAILURE: PDF file was not created!")
        
    db.close()

async def test_email_sending():
    print("\n--- Running email delivery tests (Mock mode) ---")
    success, message = await send_email_with_retry(
        to_email="test-recipient@domain.com",
        pdf_path="test_template.png",  # just use image as placeholder
        provider="mock",
        api_key="mockkey"
    )
    print(f"Email Dispatch: Success={success}, Message={message}")

def cleanup_test_files(template_path, excel_path):
    print("\nCleaning up temporary test files...")
    for f in [template_path, excel_path]:
        if os.path.exists(f):
            os.remove(f)
            print(f"Removed {f}")

if __name__ == "__main__":
    template, excel, test_data = setup_test_files()
    # Clean up any existing DB file before test starts
    db_file = os.path.join(os.path.dirname(__file__), "app.db")
    if os.path.exists(db_file):
        try:
            os.remove(db_file)
        except Exception:
            pass
    try:
        test_database_and_generator(template, excel, test_data)
        asyncio.run(test_email_sending())
    finally:
        cleanup_test_files(template, excel)
        # Dispose of engine to release database locks
        try:
            engine.dispose()
        except Exception:
            pass
        # Remove DB file if created
        db_file = os.path.join(os.path.dirname(__file__), "app.db")
        if os.path.exists(db_file):
            try:
                os.remove(db_file)
                print("Cleaned up database file")
            except Exception as e:
                print(f"Failed to remove database file: {e}")
        # Remove database journal files if any
        for f in os.listdir(os.path.dirname(__file__)):
            if f.startswith("app.db"):
                try:
                    os.remove(os.path.join(os.path.dirname(__file__), f))
                except Exception:
                    pass

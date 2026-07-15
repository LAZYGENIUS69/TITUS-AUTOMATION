import json
from sqlalchemy.orm import Session
from typing import List, Dict, Any
import models
import schemas

# Event Operations
def get_event(db: Session, event_id: int):
    return db.query(models.Event).filter(models.Event.id == event_id).first()

def get_events(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Event).offset(skip).limit(limit).all()

def create_event(db: Session, event: schemas.EventCreate, template_path: str):
    db_event = models.Event(name=event.name, template_path=template_path)
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event

def delete_event(db: Session, event_id: int):
    db_event = db.query(models.Event).filter(models.Event.id == event_id).first()
    if db_event:
        db.delete(db_event)
        db.commit()
        return True
    return False

def set_event_fields(db: Session, event_id: int, fields: List[schemas.EventFieldCreate]):
    # Delete existing fields
    db.query(models.EventField).filter(models.EventField.event_id == event_id).delete()

    # Add new fields
    db_fields = [
        models.EventField(
            event_id=event_id,
            placeholder=f.placeholder,
            x=f.x,
            y=f.y,
            width=f.width,
            height=f.height,
            font_size=f.font_size,
            font_path=f.font_path,
            font_color=f.font_color,
            format_type=f.format_type,
            format_config=f.format_config,
            font_filename=f.font_filename,
            vertical_offset=f.vertical_offset,
        ) for f in fields
    ]
    db.add_all(db_fields)
    db.commit()
    return db_fields

# Run Operations
def get_run(db: Session, run_id: int):
    return db.query(models.Run).filter(models.Run.id == run_id).first()

def get_runs(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Run).order_by(models.Run.created_at.desc()).offset(skip).limit(limit).all()

def create_run(db: Session, event_id: int, excel_filename: str, email_column: str):
    db_run = models.Run(
        event_id=event_id,
        excel_filename=excel_filename,
        email_column=email_column,
        status="pending"
    )
    db.add(db_run)
    db.commit()
    db.refresh(db_run)
    return db_run

def update_run_status(db: Session, run_id: int, status: str):
    db_run = get_run(db, run_id)
    if db_run:
        db_run.status = status
        db.commit()
        db.refresh(db_run)
    return db_run

# Run Row Operations
def get_run_row(db: Session, row_id: int):
    return db.query(models.RunRow).filter(models.RunRow.id == row_id).first()

def create_run_row(db: Session, run_id: int, row_data: Dict[str, Any]):
    db_row = models.RunRow(
        run_id=run_id,
        row_data=json.dumps(row_data),
        email_status="pending"
    )
    db.add(db_row)
    db.commit()
    db.refresh(db_row)
    return db_row

def bulk_create_run_rows(db: Session, run_id: int, rows_data: List[Dict[str, Any]]):
    db_rows = [
        models.RunRow(
            run_id=run_id,
            row_data=json.dumps(row),
            email_status="pending"
        ) for row in rows_data
    ]
    db.add_all(db_rows)
    db.commit()
    return db_rows

def update_run_row_pdf(db: Session, row_id: int, pdf_path: str, email_status: str):
    db_row = get_run_row(db, row_id)
    if db_row:
        db_row.pdf_path = pdf_path
        db_row.email_status = email_status
        db.commit()
        db.refresh(db_row)
    return db_row

def update_run_row_email(db: Session, row_id: int, email_status: str, error_message: str = None):
    db_row = get_run_row(db, row_id)
    if db_row:
        db_row.email_status = email_status
        db_row.email_error = error_message
        db.commit()
        db.refresh(db_row)
    return db_row

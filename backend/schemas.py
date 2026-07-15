from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

# Event Field schemas
class EventFieldBase(BaseModel):
    placeholder: str
    x: int
    y: int
    width: int = 400
    height: int = 60
    font_size: int = 32
    font_path: str = "arial.ttf"
    font_color: str = "#000000"
    format_type: str = "as_is"          # as_is | roman_numeral | ordinal | uppercase | title_case | custom_map
    format_config: Optional[str] = None # JSON string for custom_map key:value pairs
    font_filename: Optional[str] = None
    vertical_offset: Optional[int] = 0

class EventFieldCreate(EventFieldBase):
    pass

class PreviewRequest(BaseModel):
    fields: List[EventFieldCreate]
    preview_values: Optional[Dict[str, str]] = None

class EventField(EventFieldBase):
    id: int
    event_id: int

    class Config:
        from_attributes = True

# Event schemas
class EventBase(BaseModel):
    name: str

class EventCreate(EventBase):
    pass

class Event(EventBase):
    id: int
    template_path: str
    created_at: datetime
    template_missing: bool = False
    fields: List[EventField] = []

    class Config:
        from_attributes = True

# Run Row schemas
class RunRow(BaseModel):
    id: int
    run_id: int
    row_data: str  # JSON string
    pdf_path: Optional[str] = None
    email_status: str
    email_error: Optional[str] = None

    class Config:
        from_attributes = True

# Run schemas
class RunBase(BaseModel):
    excel_filename: str
    email_column: str

class RunCreate(RunBase):
    event_id: int

class Run(RunBase):
    id: int
    event_id: int
    status: str
    created_at: datetime
    rows: List[RunRow] = []

    class Config:
        from_attributes = True

# Aggregated Stats
class RunProgress(BaseModel):
    id: int
    event_id: int
    status: str
    excel_filename: str
    total_rows: int
    pdf_generated: int
    email_sent: int
    email_failed: int
    email_pending: int
    rows: List[RunRow] = []

import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="member", nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    template_path = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    fields = relationship("EventField", back_populates="event", cascade="all, delete-orphan")
    runs = relationship("Run", back_populates="event", cascade="all, delete-orphan")

class EventField(Base):
    __tablename__ = "event_fields"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    placeholder = Column(String, nullable=False)  # Matches Excel column name
    x = Column(Integer, nullable=False)           # X pixel coordinate
    y = Column(Integer, nullable=False)           # Y pixel coordinate
    width = Column(Integer, default=400)          # Box width in pixels
    height = Column(Integer, default=60)          # Box height in pixels
    font_size = Column(Integer, default=32)
    font_path = Column(String, default="arial.ttf")
    font_color = Column(String, default="#000000") # Hex or RGB color string
    format_type = Column(String, default="as_is")  # as_is | roman_numeral | ordinal | uppercase | title_case | custom_map
    format_config = Column(Text, nullable=True)    # JSON string for custom_map key:value pairs
    font_filename = Column(String, default=None, nullable=True)
    vertical_offset = Column(Integer, default=0, nullable=True)

    event = relationship("Event", back_populates="fields")

class Run(Base):
    __tablename__ = "runs"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    excel_filename = Column(String, nullable=False)
    email_column = Column(String, nullable=False)   # Name of the column used for the recipient's email address
    status = Column(String, default="pending")      # pending, generating, generated, sending, completed, failed
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    event = relationship("Event", back_populates="runs")
    rows = relationship("RunRow", back_populates="run", cascade="all, delete-orphan")

class RunRow(Base):
    __tablename__ = "run_rows"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer, ForeignKey("runs.id", ondelete="CASCADE"), nullable=False)
    row_data = Column(Text, nullable=False)         # JSON-serialized representation of Excel row values
    pdf_path = Column(String, nullable=True)        # Saved PDF output path
    email_status = Column(String, default="pending") # pending, generating, generated, sending, sent, failed
    email_error = Column(Text, nullable=True)       # Stores backtrace/error reason if email failed to deliver

    run = relationship("Run", back_populates="rows")

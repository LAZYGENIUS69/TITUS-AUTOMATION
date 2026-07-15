# Architecture

## Request flow

```text
React UI
  -> FastAPI endpoints
      -> SQLite event/run records
      -> Pillow PDF renderer
      -> Brevo / Resend email API
```

## Core entities

- **Event**: reusable certificate template and field mapping.
- **EventField**: placeholder, position, dimensions, font, color, and formatting rules.
- **Run**: one Excel upload associated with an event.
- **RunRow**: one recipient record, generated PDF, email status, and error log.

## Generation flow

1. The user creates an event and uploads a certificate image.
2. Fields are positioned on the template and saved to SQLite.
3. An Excel sheet is uploaded for a new run.
4. Each row is rendered into a PDF concurrently with a bounded worker pool.
5. Generated PDFs are stored under `backend/uploads/pdfs/<run-id>/`.
6. Email delivery processes only rows that have not already been sent successfully.

## Configuration loading

Both the API startup module and email sender load `backend/.env` using an explicit path. This keeps configuration independent of the shell's current working directory and prevents a stale or unrelated `.env` from being selected.

## Current boundaries

- SQLite is intended for local or single-instance deployment.
- Uploaded files are stored on the local filesystem.
- The application does not include authentication yet.
- Brevo's API response confirms request acceptance; provider delivery/open events are tracked in Brevo's dashboard rather than persisted in the app.

# API reference

The backend runs at `http://localhost:8000` during local development. Interactive OpenAPI documentation is available at `/docs`.

## Events

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/events` | Create an event with a certificate template |
| `GET` | `/api/events` | List reusable events |
| `GET` | `/api/events/{event_id}` | Read an event and its fields |
| `GET` | `/api/events/{event_id}/template-image` | Serve the event template |
| `DELETE` | `/api/events/{event_id}` | Delete an event and its template |
| `POST` | `/api/events/{event_id}/fields` | Save field mappings |
| `POST` | `/api/events/{event_id}/preview` | Generate a preview PDF |

## Fonts

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/fonts` | List available fonts |
| `GET` | `/api/fonts/file/{filename}` | Serve a font file |
| `POST` | `/api/fonts` | Upload a `.ttf` or `.otf` font |

## Runs

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/runs` | Create a run from an Excel upload |
| `GET` | `/api/runs` | List runs |
| `GET` | `/api/runs/{run_id}/status` | Read row-level progress and errors |
| `POST` | `/api/runs/{run_id}/generate` | Start PDF generation |
| `POST` | `/api/runs/{run_id}/send` | Start email delivery |

## Delivery behavior

PDF generation and email delivery run as background tasks. The API stores status per row so successful rows are not resent when a run is retried. Brevo or Resend provider events remain the source of truth for downstream delivery, bounce, and open tracking.

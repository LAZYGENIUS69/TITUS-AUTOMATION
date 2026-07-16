# TITUS Certificate Automation

TITUS is a reusable certificate automation app for creating personalized PDF certificates from an image template and sending them in bulk by email.

## What it does

- Create reusable certificate events and templates.
- Place mapped fields on a certificate canvas.
- Import recipient data from Excel.
- Generate one personalized PDF per row.
- Review generated certificates before sending.
- Send certificates through Brevo, Resend, or the local mock provider.
- Track PDF generation and email status per recipient.
- Retry failed email requests without resending successful rows.
- Switch between the light and warm charcoal dark themes.

## Project structure

```text
backend/       FastAPI API, SQLite models, PDF generation, email delivery
frontend/      React + Vite + Tailwind web application
sample_data.xlsx
sample_template.png
```

## Local setup

### Backend

```powershell
cd backend
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python -m uvicorn main:app --reload --port 8000
```

Set the provider and sender in `backend/.env`. Never commit that file.

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173> after both services are running.

## Railway deployment

Deploy the repository as two Railway services. Do not deploy the repository
root as one Railpack service.

### Backend service

- Create a service from this repository.
- Set **Root Directory** to `/backend`.
- Railway will detect `backend/Dockerfile` automatically.
- Add the backend environment variables from `backend/.env.example`, including
  `AUTH_SECRET`, `EMAIL_PROVIDER`, `BREVO_API_KEY`, and `EMAIL_FROM`.
- Add a persistent volume mounted at `/app/data` for the SQLite database and
  `/app/uploads` for uploaded templates, spreadsheets, and generated PDFs.

### Frontend service

- Create a second service from the same repository.
- Set **Root Directory** to `/frontend`.
- Railway will detect `frontend/Dockerfile` automatically.
- Set `VITE_API_BASE` to the public URL of the backend service, for example
  `https://your-backend.up.railway.app`.

The frontend URL is the link to share. The Brevo key stays only in the backend
service, and the backend service's outbound IP must be authorized in Brevo if
IP restrictions are enabled.

## Email configuration

The Brevo setup requires:

```env
EMAIL_PROVIDER=brevo
BREVO_API_KEY=your-brevo-api-key
EMAIL_FROM=Your Organization <verified-sender@example.com>
BREVO_FORCE_IPV4=true
```

The sender must be active in Brevo. If Brevo restricts API access by IP, authorize the public IP that Brevo reports for the request. Mobile and residential connections can change IP addresses.

For development without an email provider:

```env
EMAIL_PROVIDER=mock
```

## Validation

```powershell
# Frontend production build
cd frontend
npm run build

# Backend syntax check
cd ..\backend
python -m compileall -q .
```

## Security notes

- API keys belong only in `backend/.env` or deployment secret storage.
- Generated PDFs, uploaded Excel files, SQLite databases, virtual environments, and frontend dependencies are ignored by Git.
- Use a verified sender/domain before sending certificates to real recipients.

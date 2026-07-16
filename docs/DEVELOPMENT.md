# Development guide

## Recommended workflow

1. Copy `backend/.env.example` to `backend/.env`.
2. Start the backend on port `8000`.
3. Start the Vite frontend on port `5173`.
4. Use the sample template and Excel sheet for a first run.
5. Run the validation commands before committing.

## Checks

```powershell
cd backend
python -m compileall -q .

cd ..\frontend
npm run build
```

GitHub Actions repeats the backend compile and frontend production build on every push and pull request.

## Docker development

Create `backend/.env` first, then run from the repository root:

```powershell
docker compose up --build
```

The services will be available at:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`
- Backend OpenAPI docs: `http://localhost:8000/docs`

## Railway backend deployment

For a temporary hosted backend, create a Railway service from this repository with the root directory set to `backend`. Railway will use `backend/Dockerfile`; the container now listens on Railway's assigned `PORT`.

Add these variables in Railway's service settings:

```env
EMAIL_PROVIDER=brevo
BREVO_API_KEY=<set as a Railway secret>
EMAIL_FROM=Your Organization <verified-sender@example.com>
BREVO_FORCE_IPV4=true
TITUS_DB_PATH=/app/backend/data/app.db
```

Attach a Railway volume at `/app/backend/data` for the SQLite database and `/app/backend/uploads` for templates and generated PDFs. After deployment, use the Railway public URL as the frontend's `VITE_API_BASE` value in Vercel.

Uploaded templates, generated PDFs, and the database are kept in named Docker volumes rather than committed to Git. The container uses `TITUS_DB_PATH` to place SQLite data in the persistent database volume.

## Pull request expectations

- Keep API keys and real recipient data out of commits.
- Add or update documentation when an endpoint or workflow changes.
- Verify both frontend build and backend compilation.
- Include the user-visible impact and any deployment/configuration changes in the PR description.

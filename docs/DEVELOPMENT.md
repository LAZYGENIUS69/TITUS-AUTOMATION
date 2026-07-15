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

Uploaded templates, generated PDFs, and the database are kept in named Docker volumes rather than committed to Git. The container uses `TITUS_DB_PATH` to place SQLite data in the persistent database volume.

## Pull request expectations

- Keep API keys and real recipient data out of commits.
- Add or update documentation when an endpoint or workflow changes.
- Verify both frontend build and backend compilation.
- Include the user-visible impact and any deployment/configuration changes in the PR description.

# Mandi Khata

Hindi commission-invoice app for managing parties, invoices, payments, and Google Drive/Sheets sync.

## Project layout

- `frontend/` — Expo / React Native mobile app
- `backend/` — FastAPI API and Excel invoice import
- `render.yaml` — Render backend service definition
- `DEPLOYMENT.md` — Backend and Android APK deployment steps

## Run the backend locally

1. Create `backend/.env` with `MONGO_URL` and `DB_NAME`. Never commit this file.
2. Install Python dependencies from `backend/requirements-deploy.txt`.
3. Start the API from the `backend/` directory:

   ```bash
   uvicorn server:app --reload
   ```

## Run the mobile app

1. Install dependencies from `frontend/`.
2. Set `EXPO_PUBLIC_BACKEND_URL` to the backend URL (without `/api`).
3. Start Expo from `frontend/`:

   ```bash
   npx expo start
   ```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for Render and EAS APK build instructions. Keep MongoDB credentials and Google OAuth secrets out of source control.

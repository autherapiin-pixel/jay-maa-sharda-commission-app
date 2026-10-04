# Deploying Mandi Khata

## Backend on Render

1. Push the project, including `render.yaml` and `backend/requirements-deploy.txt`, to the GitHub repository.
2. In Render, create a Blueprint and select that repository. Render reads `render.yaml` and creates the API service.
3. Set `MONGO_URL` to the MongoDB Atlas connection string in Render's environment settings. Keep the connection string private.
4. After deployment, confirm the health check at `https://<render-service>/api/`.
5. Set `PUBLIC_BASE_URL` to the Render service's HTTPS URL. Configure `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_REDIRECT_URI` in Render before using Google Drive/Sheets sync.

The Render service uses `commission_party` as its database name. Image uploads also require the storage integration key; without it, invoice photo uploads will not work.

## Android APK with EAS

1. Set `EXPO_PUBLIC_BACKEND_URL` in the Expo project's `preview` environment to the deployed Render service URL (without `/api`).
2. From the `frontend` directory, sign in with `npx eas-cli login`.
3. Run `npx eas-cli build:configure` once if the Expo project has not been linked.
4. Build an installable APK with `npx eas-cli build --platform android --profile preview`.
5. When the EAS build finishes, open its build page and download the APK.

Never commit database connection strings, Google OAuth secrets, or other credentials to the repository.

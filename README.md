<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1DIIhMW9qY8tKN0HYFCjQc1JZA2aT7-tQ

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Airtable backend blueprint

The UI already exposes a hidden configuration modal (gear icon on the auth page) that expects an Airtable Personal Access Token (PAT) and Base ID. Create the Airtable base as follows so that the existing `fetchUsers`/`syncTournees` calls work without code changes:

- **Tables to create**
  - `Utilisateurs` with fields `numDome` (Single line text), `idEmploye` (Single line text), `telephone` (Phone), `email` (Email). This table stores the driver roster used by the auth screen and for audit (`Changement par`). Keep the default `Grid view` for read/write access.
  - `Tournees` with one field per column header the app generates: `Tournée`, `Nom`, `Début tournée`, `Fin tournée`, `Classe véhicule`, `Employé`, `Nom de l'employé`, `Véhicule`, `Classe véhicule affecté`, `Stationnement`, `Approuvé`, `Territoire début`, `Adresse de début`, `Adresse de fin`, `Changement`, `Changement par` (all Single line text works). The unified table produced after each extraction is written here and every in-app edit performed by drivers (vehicle reassignment, change tracking) is silently synced back to Airtable.

- **Access token and Base ID**
  - In Airtable, create a PAT with **data.records:read/write** scopes on the base and copy the Base ID (starts with `app`).
  - In the login screen of the app, click the gear icon, paste the PAT and Base ID, then save. Credentials are stored locally (not bundled) and will let the app read users and push the consolidated table to Airtable.

- **Usage flow**
  - Administrators can populate `Utilisateurs` directly in Airtable; drivers can also sign up via the app, which will create a row if the Airtable config is present, or fall back to local storage otherwise.
  - Each time a document is consolidated, the app batches inserts into `Tournees` (10 records per call) so the Airtable base stays in sync in the background without additional setup. Subsequent edits in the “Document Final” view are persisted to local storage for offline resilience and re-sent to `Tournees` to keep driver changes visible to dispatchers.

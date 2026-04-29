# Workout Tracker (Google Sheets + Service Account)

This app loads workouts from Google Sheets, shows exercise history, and logs a new workout date one exercise at a time.

It is free-tier friendly with a lightweight API layer:
- React frontend (Vite)
- Node API for secure service-account access
- No database required

## Features

- Loads available workouts from the Google Sheet
- Shows exercises for the selected workout
- Shows the latest recorded date/value per exercise
- Starts a new workout date
- Captures values one-by-one and saves all entered values back to Google Sheets

## Run Locally

```bash
npm install
npm run dev:all
```

Open the local Vite URL in your browser.

## Build

```bash
npm run build
```

## Required Sheet Schema

The app auto-detects these columns from headers:
- Workout
- Exercise
- Date
- Value

It can match common header variants (for example routine/program, movement/lift, result/weight/reps).

## Google Sheets Setup (Service Account)

To read and write with Google Cloud service account:

1. In Google Cloud, enable Google Sheets API.
2. Create a service account.
3. Create and download a JSON key file for that service account.
4. Share your target Google Sheet with the service account email (Editor access).
5. In project root, create `.env` from `.env.example` and point to your key file:

```bash
PORT=8787
GOOGLE_SERVICE_ACCOUNT_KEY_FILE=./service-account.json
```

6. In the app, provide:
	- Spreadsheet ID
	- Sheet Name

Then click Load Workouts.

The backend uses the service account to read and append rows via:
- `/api/sheets/read`
- `/api/sheets/append`

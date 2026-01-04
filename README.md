# Society Milk Collection

A small full‑stack app for society operators to enter daily milk collection (Morning/Evening) with validation, auto rate calculation, duplicate blocking, and instant reports.

## Features
- Morning and Evening sessions
- Milk types: Cow, Buffalo
- Required metrics: FAT %, SNF %, Quantity (L)
- Validation: numeric checks, limits from config, quantity > 0
- Rate auto-calculated (not manually entered)
- Amount auto-calculated
- Duplicate prevention per date + session + farmer + milk type
- Records appear in the report immediately after save

## Tech Stack
- Backend: Node.js, Express, SQLite3
- Frontend: HTML, CSS, Vanilla JS (served via Express)
- Configurable limits and pricing via `config.json`

## Project Structure
```
Society Milk Collection/
├─ package.json
├─ server.js
├─ config.json
├─ data.sqlite (auto-created)
└─ public/
   ├─ index.html
   ├─ styles.css
   ├─ app.js
   └─ images/
      ├─ cow.svg
      ├─ buffalo.svg
      └─ milk.svg
```

## Prerequisites
- Node.js (LTS recommended, v18 or newer)
- npm (installed with Node)

Download Node LTS from: https://nodejs.org/

## Setup (Windows PowerShell)
1. Install Node.js LTS and reopen your terminal/IDE.
2. In the project folder, install dependencies:
   ```powershell
   npm install
   ```
3. Start the server:
   - Development (auto-reload):
     ```powershell
     npm run dev
     ```
   - Production style:
     ```powershell
     npm start
     ```
4. Open http://localhost:3000

## Configuration
`config.json` controls FAT/SNF limits and pricing factors. Example:
```json
{
  "limits": {
    "Cow": { "fat": { "min": 3.0, "max": 6.0 }, "snf": { "min": 7.5, "max": 10.0 } },
    "Buffalo": { "fat": { "min": 5.0, "max": 9.0 }, "snf": { "min": 8.0, "max": 11.0 } }
  },
  "pricing": {
    "Cow": { "base": 20, "fat_factor": 5.0, "snf_factor": 2.0 },
    "Buffalo": { "base": 25, "fat_factor": 6.0, "snf_factor": 2.5 }
  }
}
```
- Rate formula: `rate = base + fat * fat_factor + snf * snf_factor`
- Amount: `amount = rate * quantity` (rounded to 2 decimals)

## API
- GET `/api/config` → `{ limits }`
- GET `/api/collections?date=YYYY-MM-DD` → array of saved rows
- POST `/api/collections` → create entry
  - Body fields: `date`, `session` (Morning|Evening), `milk_type` (Cow|Buffalo), `farmer_id`, `farmer_name?`, `fat`, `snf`, `quantity`
  - Server validates and ignores any client-sent `rate`/`amount`.

## Data & Duplicates
- SQLite file: `data.sqlite` in project root (auto-created on first run)
- Unique constraint: `(date, session, farmer_id, milk_type)` prevents duplicates

## Troubleshooting
- "npm is not recognized": Install Node.js LTS and reopen your terminal.
- Port in use (3000): Stop other apps or set `PORT` env var before starting.
- Changing limits/rates not applied: Restart the server after editing `config.json`.

## License
MIT

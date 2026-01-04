# Functional Requirements Mapping

This document maps the Story 2 requirements to the implementation in this project.

- [x] Milk collection must be entered twice daily (Morning & Evening)
  - Frontend: `index.html` session select
  - Backend: DB constraint `CHECK (session IN ('Morning','Evening'))`
- [x] Milk types supported: Cow and Buffalo
  - Frontend: `index.html` milk type select
  - Backend: DB constraint `CHECK (milk_type IN ('Cow','Buffalo'))`
- [x] Entry must include FAT %, SNF %, and Quantity
  - Frontend: required inputs for `fat`, `snf`, `quantity`
  - Backend: server-side validation in `server.js`
- [x] Quantity must be numeric and greater than zero
  - Frontend: client-side checks in `public/app.js`
  - Backend: numeric check and `> 0` in `validatePayload`
- [x] FAT and SNF must be within configured limits
  - Config: `config.json` limits per type
  - Backend: `validatePayload` verifies ranges
  - Frontend: shows hints and validates using `/api/config`
- [x] Rate must not be manually entered by society
  - Frontend: no rate input field
  - Backend: ignores any client-provided rate, uses `calcRate()`
- [x] Amount must be auto-calculated by system
  - Backend: `amount = rate * quantity` (fixed to 2 decimals)
- [x] Duplicate entries for same date/session must be blocked
  - DB unique constraint on `(date, session, farmer_id, milk_type)`
  - Backend: returns 409 with clear error on violation
- [x] Data must be saved only after validation success
  - Backend: returns 400 on validation errors; insert only after validation passes
- [x] Saved records should be visible in reports immediately
  - Frontend: refreshes report table after successful save

# Non-Functional Notes
- SQLite DB file `data.sqlite` auto-created.
- Configurable pricing factors in `config.json` with formula: `base + fat*fat_factor + snf*snf_factor`.
- Basic, responsive UI with imagery in `public/images/`.

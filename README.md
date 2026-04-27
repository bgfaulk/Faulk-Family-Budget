# Faulk Family Budget

Next.js dashboard for reviewing household finances using local source files in `data/`:

- `data/Faulk Monarch Data.csv`
- `data/Faulk Budget Report v1.xlsx`
- `data/Faulk Budget Report v2.csv`
- `data/Faulk Master Bills.csv` (canonical monthly bill source of truth)

## Getting Started

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## App Routes

- `/` - home redirects to monthly ledger
- `/bills` - recurring billing expenses (editable catalog; archive/end-date aware; feeds planned ledger rows)
- `/months/[month]` - monthly planned vs actual ledger (`YYYY-MM`); when every bill is paid, use **Archive month** to open the next month and carry income forward
- `/projections` - rolling forecast from **April 2026** onward only (read-only trends)
- `/db-size` - PostgreSQL storage usage monitor (total + per-table)

## Table UX Standard

All table views should use `src/components/sortable-search-table.tsx` so they consistently support:

- search box filtering
- column sorting on click
- default descending sort for month/date columns to show most recent data first

## API Routes

- `GET/POST/PATCH /api/bills`
- `GET/POST /api/payment-sources` — saved “Paid from” labels for the recurring expenses dropdown
- `GET/POST /api/months/[month]/entries`
- `POST /api/months/[month]/rollover` — ensure next month’s planned bills exist; copy income from this month if the next month has none yet
- `GET /api/projections?horizon=12`
- `GET /api/db-size`

## Database (Drizzle + Postgres)

Schema and migrations:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed-master-bills
```

Migrations add a `payment_sources` table (unique names) and backfill it from existing `bill_templates.payment_account` values where present.

Set `DATABASE_URL` to enable write operations and persisted data. Without `DATABASE_URL`, reads use imported fallback data from the files in `data/`.

Use `db:seed-master-bills` whenever you update `data/Faulk Master Bills.csv`. It updates recurring expense rows in the database, archives anything not on the master list, and regenerates monthly plan rows from `2025-08` through 12 months ahead.

The UI displays month keys in a human-readable format (for example, `April 2026`) while URLs and database values remain `YYYY-MM`.

The monthly ledger includes:
- paid checkbox tracking per bill
- quick monthly income entry form
- quick add-recurring-expense form (creates definition + adds it to the month)

## Tests

```bash
npm run test
```

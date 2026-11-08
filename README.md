# BetFundr / LamedCash API (PostgreSQL edition)

Backend for the LamedCash mobile app: wallet, referral
bonuses, QR deposits, social feed, predictions and football data. Rebuilt from the MongoDB version on
Express 5 + Sequelize + PostgreSQL, following the layered conventions of the `core-api postgres` template.

Read **[docs/MIGRATION.md](docs/MIGRATION.md)** before deploying: it lists what changed, what the old code
left ambiguous, and the decisions that need your confirmation.

## Requirements

- Node.js 18 or newer
- PostgreSQL 13 or newer (uses the built-in `gen_random_uuid()`)

## Run it locally

```bash
npm install
cp .env.example .env            # then edit it (see "Environment" below)
createdb betfundr               # or create the database any way you like
npm run migrate                 # applies migrations/*.up.sql
npm run seed:admin              # creates the admin from ADMIN_EMAIL / ADMIN_PASSWORD
npm run dev                     # or: npm start
curl localhost:5001/health      # {"status":"ok","database":"up",...}
```

| Command | What it does |
|---|---|
| `npm start` | Start the API |
| `npm run dev` | Start with auto-reload and readable logs |
| `npm run migrate` | Apply pending migrations (each file in its own transaction) |
| `npm run migrate:status` | Show applied / pending migrations |
| `node scripts/migrate.js down` | Revert the most recent migration |
| `npm run seed:admin` | Create or update the admin account |
| `npm run lint` | ESLint |
| `npm test` | Run all tests (needs a test database, see below) |

## Running the tests

The tests use a **real PostgreSQL** (no database mocks) and truncate every table between tests, so give them their own database:

```bash
createdb betfundr_test
export TEST_DATABASE_URL=postgres://USER:PASSWORD@localhost:5432/betfundr_test
npm test
```

Migrations are applied automatically. Payment providers (QOS, Fedapay, mobcash), email, push and the
football API are replaced by test doubles; everything else is real.

## Environment

Every variable is documented in [`.env.example`](.env.example). The server refuses to start without
`ACCESS_TOKEN_PRIVATE_KEY` and a database setting. Never commit `.env`.

Old name → new name: `TOKEN_SECRET` → `ACCESS_TOKEN_PRIVATE_KEY`, `APIURL1` → `FEDAPAY_CUSTOMER_API_URL`,
`SECONDAPIURL1` → `FEDAPAY_PAY_API_URL`. Check the QOS and mobcash names against your old `.env`.

## Structure

```
server.js                     process entry: config check, DB connect, HTTP + socket.io, graceful shutdown
src/app.js                    builds the Express app (used by server.js and the tests)
src/config/                   database, logger (with secret redaction), passport, aws, socket
src/routes/                   URL -> middleware -> controller
src/middlewares/              auth (JWT + session), roles, validation (Joi), rate limits, uploads, feature flags
src/controllers/              HTTP in, HTTP out. No business logic.
src/service/                  business logic. wallet / deposit / withdrawal / transfer / qr / auth / user / social ...
src/service/providers/        every external system behind one small adapter (mobcash, qos, fedapay, storage, push, sports)
src/repositories/             database access
src/models/                   Sequelize models (one per table)
src/utils/                    handlers, constants, helpers (money, ids, mail, serializers)
migrations/                   NNN_name.up.sql / NNN_name.down.sql
scripts/                      migrate.js, seed-admin.js
test/                         wallet, financial and API tests
docs/schema.sql               current schema (generated from the migrations)
docs/MIGRATION.md             migration report
```

## API

Paths are unchanged from the MongoDB version so the mobile app keeps working. Send the token as
`Authorization: Bearer <token>`. Money endpoints accept an optional `Idempotency-Key` header: repeating a
request with the same key returns the original result and never moves money twice.

| Area | Endpoints |
|---|---|
| Public auth | `POST /api/usersWithoutToken/` `register`, `login`, `resetPassword`, `checkPin2`, `resetPasswordForLoggedInUser2` |
| Public payments | `POST noLogindeposit` (pay a QR), `POST deposit2` (pay by email), `POST deposit` (provider callback, secret-protected), `POST checkQRCodeValidity`, `GET getQRCode` |
| Account | `POST /api/users/` `setPin`, `getUser`, `verifyUserPin`, `getUpdatedData`, `resetPasswordForLoggedInUser`, `requestPin`, `checkPin`, `changeUserPin`, `changeColorScheme`, `setTag`, `getTotalReferral`, `editProfileImage`, `changeUserDetails`, `submitDeleteAccountForm`, `searchSendingPage`, `generateQRCode`, `GET getSocials`, `GET privacy-policies` |
| Money | `POST /api/users/` `deposit`, `depositWithFedapay`, `walletdeposit`, `withdrawal`, `walletSend` |
| Social | `/api/posts` (feeds, create, like, comment, view, save, edit, delete), `/api/users/actions` (`follow`, `data`, `token`) |
| Predictions | `/api/predictions`: reads for any signed-in user, writes for admins only |
| Football data | `GET /api/fixtures` (+ `leagues`, `events`, `lineups`, `standings`, `statistics`, `game`) |
| Ops | `GET /health` |

## How money is kept safe (short version)

- Wallet balances are `NUMERIC(20,4)` with `CHECK (bonus_balance >= 0)`. Every change is one guarded SQL
  statement plus an append-only `ledger_entries` row, inside one database transaction.
- Transactions can only move `Pending` to `Successful` or `Failed`, once. A database trigger enforces it.
- No provider call ever happens while a database transaction is open. Wallet money is held first,
  and returned only when a provider definitely failed. Unknown outcomes stay `Pending`.
- A deposit credits the cashdesk at most once, whatever mix of retries, callbacks and pollers hits it.

Details and the test evidence are in `docs/MIGRATION.md`.

DROP TABLE IF EXISTS payment_events;
DROP TRIGGER IF EXISTS ledger_entries_no_update ON ledger_entries;
DROP TABLE IF EXISTS ledger_entries;
DROP FUNCTION IF EXISTS ledger_entries_append_only();
DROP TRIGGER IF EXISTS transactions_guard_status_trg ON transactions;
DROP TABLE IF EXISTS transactions;
DROP FUNCTION IF EXISTS transactions_guard_status();
DROP TABLE IF EXISTS qr_code_deposits;

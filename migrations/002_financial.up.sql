-- 002: QR deposits, transactions, wallet ledger, payment-event log

CREATE TABLE qr_code_deposits (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users (id),
  email                 TEXT NOT NULL,
  fullname              TEXT,
  bet_id                TEXT NOT NULL,
  amount                NUMERIC(20, 4) NOT NULL CHECK (amount > 0),
  service               TEXT,
  qrcode_status         TEXT NOT NULL DEFAULT 'Pending' CHECK (qrcode_status IN ('Pending', 'Expired')),
  used                  BOOLEAN NOT NULL DEFAULT FALSE,
  payment_confirmation  TEXT NOT NULL DEFAULT 'Pending'
                          CHECK (payment_confirmation IN ('Pending', 'Successful', 'Failed')),
  valid_until           TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX qr_code_deposits_user_created_idx ON qr_code_deposits (user_id, created_at DESC);
CREATE INDEX qr_code_deposits_open_idx ON qr_code_deposits (created_at) WHERE used = FALSE AND qrcode_status = 'Pending';

-- One row per user-visible transaction. Replaces user.transactionHistory[],
-- user.pendingDeposit[], user.bonus[], admin.transactionHistory[] and admin.pendingTransactions[].
CREATE TABLE transactions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference               TEXT NOT NULL,                     -- was identifierId
  funding_type            TEXT NOT NULL
                            CHECK (funding_type IN ('deposits', 'withdrawals', 'send', 'receive', 'bonus')),
  status                  TEXT NOT NULL CHECK (status IN ('Pending', 'Successful', 'Failed')),
  payment_confirmation    TEXT CHECK (payment_confirmation IN ('Pending', 'Successful', 'Failed')),
  user_id                 UUID NOT NULL REFERENCES users (id),
  counterparty_id         UUID REFERENCES users (id),        -- recipientid / sender
  amount                  NUMERIC(20, 4) NOT NULL DEFAULT 0 CHECK (amount >= 0),        -- cash moved through the provider
  total_amount            NUMERIC(20, 4) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),  -- full value of the operation
  wallet_amount           NUMERIC(20, 4) NOT NULL DEFAULT 0 CHECK (wallet_amount >= 0), -- wallet portion (was "bonusBalance")
  bet_id                  TEXT,
  momo_number             TEXT,
  momo_name               TEXT,
  network                 TEXT,
  service                 TEXT,
  withdrawal_code         TEXT,
  custom_error_code       INTEGER,
  authenticated_deposit   BOOLEAN NOT NULL DEFAULT TRUE,
  qr_code_id              UUID REFERENCES qr_code_deposits (id),
  provider                TEXT,
  provider_transaction_id TEXT,
  idempotency_key         TEXT,
  user_email              TEXT,
  sender_name             TEXT,
  recipient_name          TEXT,
  recipient_tag           TEXT,
  metadata                JSONB NOT NULL DEFAULT '{}'::jsonb,
  registered_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A transfer is two rows (send + receive) that share one reference.
CREATE UNIQUE INDEX transactions_reference_type_uq ON transactions (reference, funding_type);
-- Same client retry => same transaction, never a second debit.
CREATE UNIQUE INDEX transactions_idempotency_uq ON transactions (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX transactions_user_registered_idx ON transactions (user_id, registered_at DESC);
CREATE INDEX transactions_status_idx          ON transactions (status) WHERE status = 'Pending';
CREATE INDEX transactions_dup_window_idx      ON transactions (bet_id, amount, registered_at)
  WHERE funding_type = 'deposits' AND status = 'Successful';
CREATE INDEX transactions_provider_ref_idx    ON transactions (provider, provider_transaction_id)
  WHERE provider_transaction_id IS NOT NULL;

-- Successful and Failed are terminal. Pending may move to either, once.
CREATE FUNCTION transactions_guard_status() RETURNS trigger AS $$
BEGIN
  IF OLD.status IN ('Successful', 'Failed') AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'transaction % is % and cannot become %', OLD.id, OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.funding_type IS DISTINCT FROM OLD.funding_type
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.reference IS DISTINCT FROM OLD.reference THEN
    RAISE EXCEPTION 'transaction % identity fields are immutable', OLD.id
      USING ERRCODE = 'check_violation';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transactions_guard_status_trg
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION transactions_guard_status();

-- Append-only audit trail of every wallet balance change.
CREATE TABLE ledger_entries (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES users (id),
  transaction_id  UUID REFERENCES transactions (id),
  entry_type      TEXT NOT NULL CHECK (entry_type IN (
                    'deposit_hold', 'deposit_refund', 'withdrawal_hold', 'withdrawal_refund',
                    'transfer_out', 'transfer_in', 'referral_bonus', 'adjustment')),
  amount          NUMERIC(20, 4) NOT NULL CHECK (amount <> 0),     -- signed change
  balance_after   NUMERIC(20, 4) NOT NULL CHECK (balance_after >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ledger_entries_user_idx ON ledger_entries (user_id, id DESC);
CREATE INDEX ledger_entries_tx_idx   ON ledger_entries (transaction_id);

CREATE FUNCTION ledger_entries_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entries is append-only' USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_entries_no_update BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_entries_append_only();

-- Provider callbacks are logged, never trusted: the status is re-verified with the provider.
CREATE TABLE payment_events (
  id           BIGSERIAL PRIMARY KEY,
  provider     TEXT NOT NULL,
  reference    TEXT NOT NULL,
  reported_status TEXT,
  raw          JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX payment_events_ref_idx ON payment_events (provider, reference);

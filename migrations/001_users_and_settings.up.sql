-- 001: users, platform settings, bet ids, account-deletion requests
-- Requires PostgreSQL 13+ (gen_random_uuid() is built in).

CREATE TABLE users (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fullname                  TEXT        NOT NULL,
  email                     TEXT        NOT NULL,
  password_hash             TEXT        NOT NULL,
  pin_hash                  TEXT,
  pin_state                 BOOLEAN     NOT NULL DEFAULT FALSE,
  bet_id                    TEXT,
  phone_number              TEXT,
  tag                       TEXT,
  role                      TEXT        NOT NULL DEFAULT 'user'
                              CHECK (role IN ('user', 'admin', 'subadmin')),
  is_sub_admin_deposits     BOOLEAN     NOT NULL DEFAULT FALSE,
  is_sub_admin_withdrawals  BOOLEAN     NOT NULL DEFAULT FALSE,
  is_activated              BOOLEAN     NOT NULL DEFAULT TRUE,
  is_logged_in              BOOLEAN     NOT NULL DEFAULT FALSE,
  session_id                UUID,
  delete_request_state      BOOLEAN     NOT NULL DEFAULT FALSE,
  image                     TEXT        NOT NULL DEFAULT '',
  image_file_name           TEXT        NOT NULL DEFAULT '',
  push_token                TEXT,
  expo_push_token           TEXT,
  color_scheme              SMALLINT    NOT NULL DEFAULT 2,
  fedapay_id                BIGINT,
  referrer_id               UUID        REFERENCES users (id) ON DELETE SET NULL,
  -- wallet. NUMERIC keeps money exact; the CHECKs make overdrafts impossible.
  bonus_balance             NUMERIC(20, 4) NOT NULL DEFAULT 0 CHECK (bonus_balance >= 0),
  restricted_bonus_balance  NUMERIC(20, 4) NOT NULL DEFAULT 0 CHECK (restricted_bonus_balance >= 0),
  successful_deposit_count  INTEGER     NOT NULL DEFAULT 0 CHECK (successful_deposit_count >= 0),
  successful_withdrawal_count INTEGER   NOT NULL DEFAULT 0 CHECK (successful_withdrawal_count >= 0),
  -- one-time code emailed for PIN / password reset (stored hashed)
  reset_code_hash           TEXT,
  reset_code_expires_at     TIMESTAMPTZ,
  registered_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_lower_uq ON users (lower(email));
CREATE UNIQUE INDEX users_tag_lower_uq   ON users (lower(tag)) WHERE tag IS NOT NULL;
CREATE UNIQUE INDEX users_session_uq     ON users (session_id) WHERE session_id IS NOT NULL;
CREATE INDEX users_referrer_idx          ON users (referrer_id) WHERE referrer_id IS NOT NULL;
CREATE INDEX users_role_idx              ON users (role);

-- Replaces the single "admin" document's switches and counters.
CREATE TABLE platform_settings (
  id                       SMALLINT PRIMARY KEY CHECK (id = 1),
  is_deposits_open         BOOLEAN NOT NULL DEFAULT TRUE,
  is_withdrawals_open      BOOLEAN NOT NULL DEFAULT TRUE,
  disbursed_bonus_balance  NUMERIC(20, 4) NOT NULL DEFAULT 0 CHECK (disbursed_bonus_balance >= 0),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO platform_settings (id) VALUES (1);

-- Replaces users.supplementaryBetId[]
CREATE TABLE user_bet_ids (
  user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  bet_id     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, bet_id)
);

-- Replaces admin.deleteRequest[]
CREATE TABLE account_deletion_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  email        TEXT NOT NULL,
  state        BOOLEAN NOT NULL DEFAULT TRUE,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX account_deletion_requests_user_idx ON account_deletion_requests (user_id);

-- 005: lock a reset code after repeated wrong guesses (a 6 digit code is brute-forceable without a limit)
ALTER TABLE users ADD COLUMN reset_code_attempts SMALLINT NOT NULL DEFAULT 0 CHECK (reset_code_attempts >= 0);

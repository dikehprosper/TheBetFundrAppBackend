-- 004: predictions and the football-data cache

CREATE TABLE prediction_leagues (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  league     TEXT NOT NULL,
  image      TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE prediction_teams (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team       TEXT NOT NULL,
  image      TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The old app had two identical collections (MatchPrediction, SecondMatchPrediction): list 1 and 2.
CREATE TABLE match_predictions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_no     SMALLINT NOT NULL CHECK (list_no IN (1, 2)),
  team1       TEXT NOT NULL,
  team1_flag  TEXT,
  team2       TEXT NOT NULL,
  team2_flag  TEXT,
  league      TEXT NOT NULL,
  league_flag TEXT,
  tip         TEXT NOT NULL,
  match_date  DATE NOT NULL DEFAULT CURRENT_DATE,   -- was createdAt "YYYY-MM-DD"
  time        TEXT NOT NULL,
  status      TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX match_predictions_list_idx ON match_predictions (list_no, match_date DESC);

-- Replaces Fixtures, Leagues, Standings, Events, Lineup and Statistics collections.
-- kind: fixtures | leagues | standings | events | lineups | statistics
CREATE TABLE api_cache (
  kind       TEXT NOT NULL,
  cache_key  TEXT NOT NULL,
  payload    JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (kind, cache_key)
);

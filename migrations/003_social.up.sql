-- 003: follows, posts, comments, notifications

CREATE TABLE follows (
  follower_id  UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id <> following_id)
);
CREATE INDEX follows_following_idx ON follows (following_id);

CREATE TABLE posts (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  body       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX posts_user_idx    ON posts (user_id, created_at DESC);
CREATE INDEX posts_created_idx ON posts (created_at DESC);

CREATE TABLE post_media (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id  UUID NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  url      TEXT NOT NULL,
  type     TEXT NOT NULL CHECK (type IN ('image', 'video')),
  position SMALLINT NOT NULL DEFAULT 0
);
CREATE INDEX post_media_post_idx ON post_media (post_id, position);

CREATE TABLE post_likes (
  post_id    UUID NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX post_likes_user_idx ON post_likes (user_id);

CREATE TABLE post_views (
  post_id    UUID NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE post_saves (
  post_id    UUID NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX post_saves_user_idx ON post_saves (user_id);

CREATE TABLE comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX comments_post_idx ON comments (post_id, created_at);
CREATE INDEX comments_user_idx ON comments (user_id);

CREATE TABLE notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  to_user_id   UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  description  TEXT NOT NULL,
  post_id      UUID REFERENCES posts (id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_to_idx ON notifications (to_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS users (
    id           TEXT PRIMARY KEY,
    username     VARCHAR(64)  NOT NULL UNIQUE,
    email        VARCHAR(255) NOT NULL DEFAULT '',
    display_name VARCHAR(100) NOT NULL,
    bio          VARCHAR(280) NOT NULL DEFAULT '',
    location     VARCHAR(100),
    github_url   VARCHAR(255),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS skills (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS skills_name_lower_idx ON skills (lower(name));

CREATE TABLE IF NOT EXISTS user_skills (
    user_id  TEXT    NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    skill_id INTEGER NOT NULL REFERENCES skills (id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, skill_id)
);

CREATE TABLE IF NOT EXISTS follows (
    follower_id TEXT        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    followed_id TEXT        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (follower_id, followed_id),
    CHECK (follower_id <> followed_id)
);
CREATE INDEX IF NOT EXISTS follows_followed_idx ON follows (followed_id);

CREATE TABLE IF NOT EXISTS projects (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(80)  NOT NULL,
    description TEXT         NOT NULL DEFAULT '',
    repo_url    VARCHAR(255),
    owner_id    TEXT         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS projects_name_lower_idx ON projects (lower(name));
CREATE INDEX IF NOT EXISTS projects_owner_idx ON projects (owner_id);

CREATE TABLE IF NOT EXISTS technologies (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS technologies_name_lower_idx ON technologies (lower(name));

CREATE TABLE IF NOT EXISTS project_technologies (
    project_id    UUID    NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    technology_id INTEGER NOT NULL REFERENCES technologies (id) ON DELETE CASCADE,
    PRIMARY KEY (project_id, technology_id)
);

CREATE TABLE IF NOT EXISTS project_members (
    project_id UUID        NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    user_id    TEXT        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS project_members_user_idx ON project_members (user_id);

CREATE TABLE IF NOT EXISTS contribution_requests (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID        NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    user_id    TEXT        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    message    TEXT        NOT NULL,
    status     VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    decided_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS contribution_one_pending_idx ON contribution_requests (project_id, user_id) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS pull_requests (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id    UUID         NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    author_id     TEXT         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    title         VARCHAR(120) NOT NULL,
    description   TEXT         NOT NULL DEFAULT '',
    source_branch VARCHAR(100) NOT NULL,
    target_branch VARCHAR(100) NOT NULL,
    status        VARCHAR(10)  NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'merged')),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    merged_at     TIMESTAMPTZ,
    closed_at     TIMESTAMPTZ,
    CHECK (source_branch <> target_branch)
);
CREATE INDEX IF NOT EXISTS pull_requests_project_idx ON pull_requests (project_id, status);
CREATE INDEX IF NOT EXISTS pull_requests_author_idx ON pull_requests (author_id);

CREATE TABLE IF NOT EXISTS pull_request_files (
    id              SERIAL PRIMARY KEY,
    pull_request_id UUID         NOT NULL REFERENCES pull_requests (id) ON DELETE CASCADE,
    path            VARCHAR(255) NOT NULL,
    patch           TEXT         NOT NULL,
    position        INTEGER      NOT NULL DEFAULT 0,
    UNIQUE (pull_request_id, path)
);

CREATE TABLE IF NOT EXISTS reviews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pull_request_id UUID        NOT NULL REFERENCES pull_requests (id) ON DELETE CASCADE,
    reviewer_id     TEXT        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    verdict         VARCHAR(20) NOT NULL CHECK (verdict IN ('approved', 'changes_requested', 'commented')),
    body            TEXT        NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reviews_pull_request_idx ON reviews (pull_request_id);

CREATE TABLE IF NOT EXISTS review_comments (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_id  UUID         NOT NULL REFERENCES reviews (id) ON DELETE CASCADE,
    file_path  VARCHAR(255) NOT NULL,
    line       INTEGER      NOT NULL CHECK (line >= 0),
    body       TEXT         NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS review_comments_review_idx ON review_comments (review_id);

CREATE TABLE IF NOT EXISTS activities (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type         VARCHAR(30)  NOT NULL CHECK (type IN (
                     'project_created', 'contribution_requested', 'contribution_accepted',
                     'pr_opened', 'pr_merged', 'pr_closed', 'review_submitted', 'user_followed')),
    actor_id     TEXT         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    project_id   UUID         REFERENCES projects (id) ON DELETE CASCADE,
    target_id    TEXT,
    target_label VARCHAR(255),
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activities_created_idx ON activities (created_at DESC);
CREATE INDEX IF NOT EXISTS activities_actor_idx ON activities (actor_id);
CREATE INDEX IF NOT EXISTS activities_project_idx ON activities (project_id);
CREATE INDEX IF NOT EXISTS activities_target_idx ON activities (target_id);

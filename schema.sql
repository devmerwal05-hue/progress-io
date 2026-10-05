-- SQLite schema for the Progress dashboard.
-- The starter UI uses localStorage so it can run without a server; these
-- tables are ready for a hosted SQLite/API adapter.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  display_name TEXT NOT NULL,
  email TEXT UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
  category TEXT NOT NULL CHECK(category IN ('Wellness', 'Focus', 'Learning', 'Personal')),
  frequency TEXT NOT NULL DEFAULT 'daily',
  target_minutes INTEGER,
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS habit_completions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  completed_on TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(goal_id, completed_on)
);

CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id INTEGER REFERENCES goals(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_completions_date ON habit_completions(completed_on);
CREATE INDEX IF NOT EXISTS idx_activity_user_date ON activity(user_id, occurred_at DESC);

-- Supabase production sync table.
CREATE TABLE IF NOT EXISTS user_workspaces (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, workspace_id)
);

ALTER TABLE user_workspaces ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own workspaces" ON user_workspaces;
CREATE POLICY "Users manage own workspaces" ON user_workspaces
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

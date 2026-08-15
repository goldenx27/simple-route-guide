CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL,
  child_id TEXT NOT NULL,
  status TEXT NOT NULL,
  current_step INTEGER NOT NULL DEFAULT 0,
  current_instruction_index INTEGER NOT NULL DEFAULT 0,
  remaining_stops INTEGER,
  last_lat REAL,
  last_lon REAL,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trips_child_status ON trips(child_id, status);

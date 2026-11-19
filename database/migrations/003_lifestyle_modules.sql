-- 需求 4：日常 = 开发 / 测试 / 写作，生活 = 健身 / 饮食 / 阅读 / 日常睡眠。
-- 新增「测试、写作、阅读、日常睡眠」四个模块的数据表；旧模块表保持不动，历史数据不丢失。

CREATE TABLE IF NOT EXISTS test_cases (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  case_type TEXT NOT NULL DEFAULT 'functional',
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'medium',
  expected TEXT NOT NULL DEFAULT '',
  actual TEXT NOT NULL DEFAULT '',
  related_module TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  tested_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS writing_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'article',
  status TEXT NOT NULL DEFAULT 'draft',
  word_count INTEGER,
  target_date TEXT,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS reading_items (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'reading',
  progress INTEGER,
  rating INTEGER,
  notes TEXT NOT NULL DEFAULT '',
  finished_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS sleep_records (
  id TEXT PRIMARY KEY,
  sleep_date TEXT NOT NULL,
  bedtime TEXT NOT NULL DEFAULT '',
  wake_time TEXT NOT NULL DEFAULT '',
  duration_min INTEGER,
  deep_min INTEGER,
  light_min INTEGER,
  rem_min INTEGER,
  awake_min INTEGER,
  score INTEGER,
  source TEXT NOT NULL DEFAULT 'manual',
  external_id TEXT NOT NULL DEFAULT '',
  device TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_test_cases_status ON test_cases(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_writing_items_status ON writing_items(status, target_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reading_items_status ON reading_items(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sleep_records_date ON sleep_records(sleep_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sleep_records_external ON sleep_records(source, external_id) WHERE deleted_at IS NULL;

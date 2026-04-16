-- Anti-Gaming Compliance Dashboard
-- PostgreSQL schema draft

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE severity_level AS ENUM ('low', 'medium', 'high');
CREATE TYPE resolution_status AS ENUM ('pending', 'approved', 'voided', 'escalated_to_hr');
CREATE TYPE action_taken AS ENUM ('approved', 'voided', 'escalated_to_hr');

CREATE TABLE agents (
  agent_id VARCHAR(32) PRIMARY KEY,
  agent_name VARCHAR(120) NOT NULL,
  branch_name VARCHAR(120) NOT NULL,
  role_name VARCHAR(50) NOT NULL DEFAULT 'agent',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE managers (
  manager_id VARCHAR(32) PRIMARY KEY,
  manager_name VARCHAR(120) NOT NULL,
  department_name VARCHAR(120) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE courses (
  course_id VARCHAR(50) PRIMARY KEY,
  course_name VARCHAR(150) NOT NULL,
  expected_duration_seconds INTEGER NOT NULL,
  passing_score INTEGER NOT NULL DEFAULT 80,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE compliance_rules (
  rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_code VARCHAR(50) NOT NULL UNIQUE,
  rule_name VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  parameter_json JSONB NOT NULL,
  severity_level severity_level NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE learning_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(32) NOT NULL REFERENCES agents(agent_id),
  course_id VARCHAR(50) NOT NULL REFERENCES courses(course_id),
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  quiz_seconds INTEGER,
  quiz_score INTEGER,
  context_switch_count INTEGER NOT NULL DEFAULT 0,
  cards_swiped INTEGER NOT NULL DEFAULT 0,
  leaderboard_points INTEGER NOT NULL DEFAULT 0,
  streak_shield_locked BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_learning_sessions_agent_created_at
  ON learning_sessions(agent_id, created_at DESC);

CREATE INDEX idx_learning_sessions_course_created_at
  ON learning_sessions(course_id, created_at DESC);

CREATE TABLE session_events (
  event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES learning_sessions(session_id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  event_timestamp TIMESTAMPTZ NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_session_events_session_timestamp
  ON session_events(session_id, event_timestamp);

CREATE INDEX idx_session_events_event_type
  ON session_events(event_type);

CREATE TABLE flagged_sessions (
  flag_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES learning_sessions(session_id) ON DELETE CASCADE,
  agent_id VARCHAR(32) NOT NULL REFERENCES agents(agent_id),
  rule_violated_id UUID NOT NULL REFERENCES compliance_rules(rule_id),
  flag_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolution_status resolution_status NOT NULL DEFAULT 'pending',
  severity_level severity_level NOT NULL,
  risk_reason TEXT NOT NULL,
  leaderboard_points_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  streak_shield_locked BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE UNIQUE INDEX uq_flagged_sessions_session_rule
  ON flagged_sessions(session_id, rule_violated_id);

CREATE INDEX idx_flagged_sessions_status_timestamp
  ON flagged_sessions(resolution_status, flag_timestamp DESC);

CREATE INDEX idx_flagged_sessions_severity_timestamp
  ON flagged_sessions(severity_level, flag_timestamp DESC);

CREATE INDEX idx_flagged_sessions_agent_timestamp
  ON flagged_sessions(agent_id, flag_timestamp DESC);

CREATE TABLE compliance_audit_log (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id UUID NOT NULL REFERENCES flagged_sessions(flag_id) ON DELETE CASCADE,
  manager_id VARCHAR(32) NOT NULL REFERENCES managers(manager_id),
  action_taken action_taken NOT NULL,
  manager_justification_notes TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_compliance_audit_log_flag_created_at
  ON compliance_audit_log(flag_id, created_at DESC);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_compliance_rules_updated_at
BEFORE UPDATE ON compliance_rules
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

INSERT INTO agents (agent_id, agent_name, branch_name)
VALUES
  ('A1028', '陳冠宇', '台北信義分行'),
  ('A2041', '林怡君', '新北板橋分行'),
  ('A3350', '黃品蓉', '桃園中壢分行');

INSERT INTO managers (manager_id, manager_name, department_name)
VALUES
  ('M208', '李宜蓁', '合規管理處'),
  ('M110', '蔡佩珊', '分行管理處');

INSERT INTO courses (course_id, course_name, expected_duration_seconds, passing_score)
VALUES
  ('COURSE-AML-101', 'AML 防制洗錢必修', 420, 80),
  ('COURSE-INV-230', '投資型保單揭露規範', 430, 80),
  ('COURSE-CROSS-120', '保險商品交叉銷售守則', 420, 80);

INSERT INTO compliance_rules (rule_code, rule_name, description, parameter_json, severity_level)
VALUES
  (
    'IMPOSSIBLE_SPEED',
    '不可能的完成速度',
    '完成時間低於課程平均時間的 20%',
    '{"min_course_average_ratio": 0.2}'::jsonb,
    'high'
  ),
  (
    'BLIND_GUESSING',
    '盲猜略過測驗',
    '5 秒內完成測驗且得分為 0',
    '{"max_quiz_seconds": 5, "score_equals": 0}'::jsonb,
    'medium'
  ),
  (
    'EXCESSIVE_CONTEXT_SWITCH',
    '高頻切換視窗',
    '7 分鐘學習期間切換頁籤或 App 超過 5 次',
    '{"max_context_switches": 5, "window_minutes": 7}'::jsonb,
    'high'
  );

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
  weekly_reward_points INTEGER NOT NULL DEFAULT 0,
  streak_shield_locked BOOLEAN NOT NULL DEFAULT FALSE,
  module_completion_frozen BOOLEAN NOT NULL DEFAULT FALSE,
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
  streak_shield_locked BOOLEAN NOT NULL DEFAULT FALSE,
  module_completion_frozen BOOLEAN NOT NULL DEFAULT FALSE
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
  flag_id UUID NOT NULL REFERENCES flagged_sessions(flag_id),
  manager_id VARCHAR(32) NOT NULL REFERENCES managers(manager_id),
  action_taken action_taken NOT NULL,
  manager_justification_notes TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_compliance_audit_log_flag_created_at
  ON compliance_audit_log(flag_id, created_at DESC);

COMMENT ON TABLE compliance_audit_log IS
  'Append-only audit log. Supervisor resolution actions must be permanently retained.';

CREATE OR REPLACE FUNCTION prevent_compliance_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'compliance_audit_log is append-only; % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_compliance_audit_log_no_update_delete
BEFORE UPDATE OR DELETE ON compliance_audit_log
FOR EACH ROW
EXECUTE FUNCTION prevent_compliance_audit_log_mutation();

CREATE TRIGGER trg_compliance_audit_log_no_truncate
BEFORE TRUNCATE ON compliance_audit_log
FOR EACH STATEMENT
EXECUTE FUNCTION prevent_compliance_audit_log_mutation();

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
  ('M110', '蔡佩珊', '分行管理處'),
  ('M336', '王建銘', '教育訓練處');

INSERT INTO courses (course_id, course_name, expected_duration_seconds, passing_score)
VALUES
  ('COURSE-AML-101', 'AML 防制洗錢必修', 420, 80),
  ('COURSE-INV-230', '投資型保單揭露規範', 430, 80),
  ('COURSE-CROSS-120', '保險商品交叉銷售守則', 420, 80);

INSERT INTO compliance_rules (rule_code, rule_name, description, parameter_json, severity_level)
VALUES
  (
    'IMPOSSIBLE_SPEED',
    '異常速度',
    '30 秒內完成或交卷，且答錯題數小於等於 5 題',
    '{"max_duration_seconds": 30, "max_wrong_count": 5, "min_course_average_ratio": 0.2}'::jsonb,
    'high'
  ),
  (
    'BLIND_GUESSING',
    '盲猜略過',
    '30 秒內交卷且答錯超過 8 題',
    '{"max_quiz_seconds": 30, "min_wrong_count": 9}'::jsonb,
    'low'
  ),
  (
    'EXCESSIVE_CONTEXT_SWITCH',
    '高頻切換視窗',
    '7 分鐘學習期間切換頁籤或 App 超過 5 次',
    '{"max_context_switches": 5, "window_minutes": 7}'::jsonb,
    'high'
  ),
  (
    'REPEATED_ANSWER_CHANGES',
    '反覆改答',
    '同一題改答達 10 次以上',
    '{"max_changes_per_question": 10}'::jsonb,
    'medium'
  ),
  (
    'LOW_INPUT_ACTIVITY',
    '低互動掛機',
    '停留超過 10 分鐘未答題，疑似低互動掛機',
    '{"min_duration_seconds": 600, "min_active_ratio": 0.08, "max_input_events": 15}'::jsonb,
    'medium'
  ),
  (
    'LOW_PAGE_FOCUS_RATIO',
    '切頁分心',
    '一次 session 切頁超過 5 次或頁面焦點比例偏低',
    '{"min_focus_ratio": 0.6, "max_hidden_count": 5}'::jsonb,
    'high'
  ),
  (
    'LONG_FACE_ABSENCE',
    '長時間離開畫面',
    '鏡頭偵測到學員長時間未出現在畫面中',
    '{"max_face_absent_seconds": 60, "max_longest_face_absence_seconds": 20}'::jsonb,
    'high'
  ),
  (
    'MULTIPLE_FACES_PRESENT',
    '多人出現在畫面中',
    '鏡頭偵測到同時有超過一張臉出現在畫面中',
    '{"max_multiple_faces_seconds": 10, "max_multiple_faces_detected_count": 0}'::jsonb,
    'high'
  );

UPDATE compliance_rules
SET is_active = FALSE
WHERE rule_code IN (
  'EXCESSIVE_CONTEXT_SWITCH'
);

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session


class RuleEvaluationService:
    def evaluate_session(self, db: Session, session_id: str) -> list[dict]:
        session_row = db.execute(
            text(
                """
                SELECT
                  ls.session_id,
                  ls.agent_id,
                  ls.course_id,
                  ls.started_at,
                  ls.finished_at,
                  ls.duration_seconds,
                  ls.quiz_seconds,
                  ls.quiz_score,
                  ls.context_switch_count,
                  c.course_name,
                  c.expected_duration_seconds
                FROM learning_sessions ls
                JOIN courses c ON c.course_id = ls.course_id
                WHERE ls.session_id = :session_id
                """
            ),
            {"session_id": session_id},
        ).mappings().first()

        if session_row is None:
            return []

        rules = db.execute(
            text(
                """
                SELECT
                  rule_id,
                  rule_code,
                  rule_name,
                  parameter_json,
                  severity_level,
                  is_active
                FROM compliance_rules
                WHERE is_active = TRUE
                """
            )
        ).mappings().all()

        created_flags: list[dict] = []
        for rule in rules:
            decision = self._evaluate_rule(rule=rule, session_row=session_row)
            if decision is None:
                continue

            already_flagged = db.execute(
                text(
                    """
                    SELECT flag_id
                    FROM flagged_sessions
                    WHERE session_id = :session_id
                      AND rule_violated_id = :rule_violated_id
                    """
                ),
                {
                    "session_id": session_id,
                    "rule_violated_id": rule["rule_id"],
                },
            ).scalar_one_or_none()
            if already_flagged is not None:
                continue

            is_high_risk = rule["severity_level"] == "high"
            flag_id = str(uuid4())
            db.execute(
                text(
                    """
                    INSERT INTO flagged_sessions (
                      flag_id,
                      session_id,
                      agent_id,
                      rule_violated_id,
                      flag_timestamp,
                      resolution_status,
                      severity_level,
                      risk_reason,
                      leaderboard_points_revoked,
                      streak_shield_locked
                    ) VALUES (
                      :flag_id,
                      :session_id,
                      :agent_id,
                      :rule_violated_id,
                      :flag_timestamp,
                      'pending',
                      :severity_level,
                      :risk_reason,
                      :leaderboard_points_revoked,
                      :streak_shield_locked
                    )
                    """
                ),
                {
                    "flag_id": flag_id,
                    "session_id": session_id,
                    "agent_id": session_row["agent_id"],
                    "rule_violated_id": rule["rule_id"],
                    "flag_timestamp": datetime.now(timezone.utc),
                    "severity_level": rule["severity_level"],
                    "risk_reason": decision["risk_reason"],
                    "leaderboard_points_revoked": is_high_risk,
                    "streak_shield_locked": is_high_risk,
                },
            )

            if is_high_risk:
                db.execute(
                    text(
                        """
                        UPDATE learning_sessions
                        SET leaderboard_points = 0,
                            streak_shield_locked = TRUE
                        WHERE session_id = :session_id
                        """
                    ),
                    {"session_id": session_id},
                )

            created_flags.append(
                {
                    "flag_id": flag_id,
                    "rule_code": rule["rule_code"],
                    "severity_level": rule["severity_level"],
                    "risk_reason": decision["risk_reason"],
                }
            )

        return created_flags

    @staticmethod
    def _evaluate_rule(rule: dict, session_row: dict) -> dict | None:
        params = rule["parameter_json"]
        rule_code = rule["rule_code"]

        if rule_code == "IMPOSSIBLE_SPEED":
            duration_seconds = session_row["duration_seconds"]
            expected_duration_seconds = session_row["expected_duration_seconds"]
            if duration_seconds is None or expected_duration_seconds is None:
                return None
            threshold_ratio = float(params.get("min_course_average_ratio", 0.2))
            threshold_seconds = expected_duration_seconds * threshold_ratio
            if duration_seconds < threshold_seconds:
                return {
                    "risk_reason": (
                        f"完成時間 {duration_seconds} 秒，低於課程平均時間 "
                        f"{expected_duration_seconds} 秒的 {int(threshold_ratio * 100)}%。"
                    )
                }
            return None

        if rule_code == "BLIND_GUESSING":
            quiz_seconds = session_row["quiz_seconds"]
            quiz_score = session_row["quiz_score"]
            if quiz_seconds is None or quiz_score is None:
                return None
            max_quiz_seconds = int(params.get("max_quiz_seconds", 5))
            expected_score = int(params.get("score_equals", 0))
            if quiz_seconds <= max_quiz_seconds and quiz_score == expected_score:
                return {
                    "risk_reason": (
                        f"測驗於 {quiz_seconds} 秒內完成且得分為 {quiz_score}，"
                        "疑似盲猜或略過作答。"
                    )
                }
            return None

        if rule_code == "EXCESSIVE_CONTEXT_SWITCH":
            context_switch_count = session_row["context_switch_count"] or 0
            max_context_switches = int(params.get("max_context_switches", 5))
            if context_switch_count > max_context_switches:
                return {
                    "risk_reason": (
                        f"學習期間切換視窗 {context_switch_count} 次，"
                        f"超過規則門檻 {max_context_switches} 次。"
                    )
                }
            return None

        return None

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
        event_metrics = self._load_event_metrics(db=db, session_id=session_id)

        created_flags: list[dict] = []
        for rule in rules:
            decision = self._evaluate_rule(
                rule=rule,
                session_row=session_row,
                event_metrics=event_metrics,
            )
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
    def _evaluate_rule(rule: dict, session_row: dict, event_metrics: dict) -> dict | None:
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

        if rule_code == "REPEATED_ANSWER_CHANGES":
            question_change_counts = event_metrics["question_change_counts"]
            total_answer_changes = event_metrics["total_answer_changes"]
            max_changes_per_question = int(params.get("max_changes_per_question", 3))
            min_total_changes = int(params.get("min_total_changes", 5))

            repeated_question = next(
                (
                    (question_id, change_count)
                    for question_id, change_count in question_change_counts.items()
                    if change_count >= max_changes_per_question
                ),
                None,
            )
            if repeated_question is not None:
                question_id, change_count = repeated_question
                return {
                    "risk_reason": (
                        f"題目 {question_id} 在單次測驗中被改答 {change_count} 次，"
                        f"超過門檻 {max_changes_per_question} 次。"
                    )
                }

            if total_answer_changes >= min_total_changes:
                return {
                    "risk_reason": (
                        f"本次測驗共發生 {total_answer_changes} 次改答，"
                        f"高於門檻 {min_total_changes} 次。"
                    )
                }
            return None

        if rule_code == "LOW_INPUT_ACTIVITY":
            duration_seconds = session_row["duration_seconds"] or 0
            if duration_seconds <= 0:
                return None

            total_active_ms = (
                event_metrics["mouse_active_milliseconds"]
                + event_metrics["keyboard_active_milliseconds"]
            )
            active_ratio = total_active_ms / (duration_seconds * 1000)
            total_input_events = (
                event_metrics["mouse_move_count"]
                + event_metrics["mouse_click_count"]
                + event_metrics["mouse_scroll_count"]
                + event_metrics["keyboard_keydown_count"]
            )
            min_active_ratio = float(params.get("min_active_ratio", 0.08))
            max_input_events = int(params.get("max_input_events", 15))

            if active_ratio < min_active_ratio and total_input_events <= max_input_events:
                return {
                    "risk_reason": (
                        f"課程期間輸入活躍比例僅 {active_ratio:.1%}，"
                        f"且滑鼠鍵盤事件總數只有 {total_input_events} 次。"
                    )
                }
            return None

        if rule_code == "LOW_PAGE_FOCUS_RATIO":
            duration_seconds = session_row["duration_seconds"] or 0
            if duration_seconds <= 0:
                return None

            focused_seconds = event_metrics["focused_seconds"]
            hidden_seconds = event_metrics["hidden_seconds"]
            hidden_count = event_metrics["hidden_count"]
            focus_ratio = focused_seconds / duration_seconds if focused_seconds > 0 else 0
            min_focus_ratio = float(params.get("min_focus_ratio", 0.6))
            max_hidden_count = int(params.get("max_hidden_count", 3))

            if focus_ratio < min_focus_ratio or hidden_count > max_hidden_count:
                return {
                    "risk_reason": (
                        f"頁面有效停留比例為 {focus_ratio:.1%}，背景停留 {hidden_seconds} 秒，"
                        f"切離頁面 {hidden_count} 次。"
                    )
                }
            return None

        if rule_code == "LONG_FACE_ABSENCE":
            face_absent_seconds = event_metrics["face_absent_seconds"]
            longest_face_absence_seconds = event_metrics["longest_face_absence_seconds"]
            max_face_absent_seconds = int(params.get("max_face_absent_seconds", 60))
            max_longest_face_absence_seconds = int(
                params.get("max_longest_face_absence_seconds", 20)
            )

            if (
                face_absent_seconds > max_face_absent_seconds
                or longest_face_absence_seconds > max_longest_face_absence_seconds
            ):
                return {
                    "risk_reason": (
                        f"鏡頭偵測顯示離開畫面總時長 {face_absent_seconds} 秒，"
                        f"單次最長離開 {longest_face_absence_seconds} 秒。"
                    )
                }
            return None

        if rule_code == "MULTIPLE_FACES_PRESENT":
            multiple_faces_seconds = event_metrics["multiple_faces_seconds"]
            multiple_faces_detected_count = event_metrics["multiple_faces_detected_count"]
            max_multiple_faces_seconds = int(params.get("max_multiple_faces_seconds", 10))
            max_multiple_faces_detected_count = int(
                params.get("max_multiple_faces_detected_count", 0)
            )

            if (
                multiple_faces_seconds > max_multiple_faces_seconds
                or multiple_faces_detected_count > max_multiple_faces_detected_count
            ):
                return {
                    "risk_reason": (
                        f"鏡頭偵測多人出現 {multiple_faces_detected_count} 次，"
                        f"累計持續 {multiple_faces_seconds} 秒。"
                    )
                }
            return None

        return None

    @staticmethod
    def _load_event_metrics(db: Session, session_id: str) -> dict:
        rows = db.execute(
            text(
                """
                SELECT
                  event_type,
                  metadata_json
                FROM session_events
                WHERE session_id = :session_id
                ORDER BY event_timestamp ASC
                """
            ),
            {"session_id": session_id},
        ).mappings().all()

        metrics = {
            "question_change_counts": {},
            "total_answer_changes": 0,
            "mouse_move_count": 0,
            "mouse_click_count": 0,
            "mouse_scroll_count": 0,
            "mouse_active_milliseconds": 0,
            "keyboard_keydown_count": 0,
            "keyboard_shortcut_count": 0,
            "keyboard_active_milliseconds": 0,
            "focused_seconds": 0,
            "hidden_seconds": 0,
            "hidden_count": 0,
            "face_present_seconds": 0,
            "face_absent_seconds": 0,
            "longest_face_absence_seconds": 0,
            "absence_count": 0,
            "multiple_faces_seconds": 0,
            "multiple_faces_detected_count": 0,
        }

        for row in rows:
            event_type = row["event_type"]
            metadata = row["metadata_json"] or {}

            if event_type == "answer_changed":
                question_id = metadata.get("question_id")
                if isinstance(question_id, str) and question_id.strip():
                    metrics["question_change_counts"][question_id] = (
                        metrics["question_change_counts"].get(question_id, 0) + 1
                    )
                    metrics["total_answer_changes"] += 1

            elif event_type == "mouse_activity":
                metrics["mouse_move_count"] += int(metadata.get("move_count", 0))
                metrics["mouse_click_count"] += int(metadata.get("click_count", 0))
                metrics["mouse_scroll_count"] += int(metadata.get("scroll_count", 0))
                metrics["mouse_active_milliseconds"] += int(metadata.get("active_milliseconds", 0))

            elif event_type == "keyboard_activity":
                metrics["keyboard_keydown_count"] += int(metadata.get("keydown_count", 0))
                metrics["keyboard_shortcut_count"] += int(metadata.get("shortcut_count", 0))
                metrics["keyboard_active_milliseconds"] += int(
                    metadata.get("active_milliseconds", 0)
                )

            elif event_type == "page_dwell_summary":
                metrics["focused_seconds"] += int(metadata.get("focused_seconds", 0))
                metrics["hidden_seconds"] += int(metadata.get("hidden_seconds", 0))
                metrics["hidden_count"] += int(metadata.get("hidden_count", 0))

            elif event_type == "camera_monitor_summary":
                metrics["face_present_seconds"] += int(metadata.get("face_present_seconds", 0))
                metrics["face_absent_seconds"] += int(metadata.get("face_absent_seconds", 0))
                metrics["longest_face_absence_seconds"] = max(
                    metrics["longest_face_absence_seconds"],
                    int(metadata.get("longest_face_absence_seconds", 0)),
                )
                metrics["absence_count"] += int(metadata.get("absence_count", 0))
                metrics["multiple_faces_seconds"] += int(metadata.get("multiple_faces_seconds", 0))
                metrics["multiple_faces_detected_count"] += int(
                    metadata.get("multiple_faces_detected_count", 0)
                )

        return metrics

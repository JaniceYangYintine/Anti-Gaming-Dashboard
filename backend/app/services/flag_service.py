from collections import Counter
from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.schemas.flag import (
    AuditLogEntry,
    FlagDetail,
    FlagListItem,
    FlagListResponse,
    ResolutionRequest,
    FlagSummaryCounts,
    RuleSnapshot,
    SessionSnapshot,
    TimelineEntry,
)
from app.services.rule_evaluation_service import BASE_MODULE_POINTS, WEEKLY_REVIEW_REWARD_POINTS


class FlagService:
    def list_flags(
        self,
        db: Session,
        severity: str = "all",
        status: str = "all",
        query: str = "",
    ) -> FlagListResponse:
        rows = db.execute(
            text(f"{self._base_flags_query().text} ORDER BY fs.flag_timestamp DESC")
        ).mappings().all()
        items = [self._build_flag_list_item(row) for row in rows]
        filtered_items = self._filter_items(items=items, severity=severity, status=status, query=query)

        summary = FlagSummaryCounts(
            total_flags=len(items),
            pending_flags=sum(1 for item in items if item.resolution_status == "pending"),
            severity_counts=dict(Counter(item.severity_level for item in items)),
            status_counts=dict(Counter(item.resolution_status for item in items)),
        )
        return FlagListResponse(summary=summary, items=filtered_items)

    def get_flag_detail(self, db: Session, flag_id: str) -> FlagDetail | None:
        row = db.execute(
            text(f"{self._base_flags_query().text} WHERE fs.flag_id = :flag_id"),
            {"flag_id": flag_id},
        ).mappings().first()
        if row is None:
            return None

        timeline_rows = db.execute(
            text(
                """
                SELECT
                  se.event_id,
                  se.event_type,
                  se.event_timestamp,
                  se.metadata_json
                FROM session_events se
                WHERE se.session_id = :session_id
                ORDER BY se.event_timestamp ASC
                """
            ),
            {"session_id": row["session_id"]},
        ).mappings().all()

        audit_rows = db.execute(
            text(
                """
                SELECT
                  cal.audit_id,
                  cal.manager_id,
                  m.manager_name,
                  cal.action_taken,
                  cal.manager_justification_notes,
                  cal.created_at,
                  a.agent_name,
                  c.course_name,
                  cr.rule_code
                FROM compliance_audit_log cal
                JOIN managers m ON m.manager_id = cal.manager_id
                JOIN flagged_sessions audited_flag ON audited_flag.flag_id = cal.flag_id
                JOIN agents a ON a.agent_id = audited_flag.agent_id
                JOIN learning_sessions ls ON ls.session_id = audited_flag.session_id
                JOIN courses c ON c.course_id = ls.course_id
                JOIN compliance_rules cr ON cr.rule_id = audited_flag.rule_violated_id
                WHERE audited_flag.session_id = :session_id
                ORDER BY cal.created_at DESC
                """
            ),
            {"session_id": row["session_id"]},
        ).mappings().all()
        if not audit_rows:
            audit_rows = db.execute(
                text(
                    """
                    SELECT
                      cal.audit_id,
                      cal.manager_id,
                      m.manager_name,
                      cal.action_taken,
                      cal.manager_justification_notes,
                      cal.created_at,
                      a.agent_name,
                      c.course_name,
                      cr.rule_code
                    FROM compliance_audit_log cal
                    JOIN managers m ON m.manager_id = cal.manager_id
                    JOIN flagged_sessions audited_flag ON audited_flag.flag_id = cal.flag_id
                    JOIN agents a ON a.agent_id = audited_flag.agent_id
                    JOIN learning_sessions ls ON ls.session_id = audited_flag.session_id
                    JOIN courses c ON c.course_id = ls.course_id
                    JOIN compliance_rules cr ON cr.rule_id = audited_flag.rule_violated_id
                    ORDER BY cal.created_at DESC
                    LIMIT 5
                    """
                )
            ).mappings().all()

        return FlagDetail(
            flag=self._build_flag_list_item(row),
            session=SessionSnapshot(
                session_id=str(row["session_id"]),
                started_at=row["started_at"].isoformat(),
                finished_at=row["finished_at"].isoformat() if row["finished_at"] else None,
                duration_seconds=row["duration_seconds"],
                quiz_seconds=row["quiz_seconds"],
                quiz_score=row["quiz_score"],
                context_switch_count=row["context_switch_count"],
                cards_swiped=row["cards_swiped"],
                leaderboard_points=row["leaderboard_points"],
                weekly_reward_points=row["weekly_reward_points"],
                streak_shield_locked=row["session_streak_shield_locked"],
                module_completion_frozen=row["module_completion_frozen"],
            ),
            rule=RuleSnapshot(
                rule_id=str(row["rule_id"]),
                rule_code=row["rule_code"],
                rule_name=row["rule_name"],
                description=row["rule_description"],
                parameter_json=row["parameter_json"],
                severity_level=row["severity_level"],
            ),
            timeline=[
                TimelineEntry(
                    event_id=str(item["event_id"]),
                    event_type=item["event_type"],
                    event_timestamp=item["event_timestamp"].isoformat(),
                    metadata_json=item["metadata_json"],
                )
                for item in timeline_rows
            ],
            audit_logs=[
                AuditLogEntry(
                    audit_id=str(item["audit_id"]),
                    manager_id=item["manager_id"],
                    manager_name=item["manager_name"],
                    action_taken=item["action_taken"],
                    manager_justification_notes=item["manager_justification_notes"],
                    created_at=item["created_at"].isoformat(),
                    agent_name=item["agent_name"],
                    course_name=item["course_name"],
                    rule_code=item["rule_code"],
                )
                for item in audit_rows
            ],
        )

    def submit_resolution(
        self,
        db: Session,
        flag_id: str,
        payload: ResolutionRequest,
    ) -> FlagDetail | None:
        existing_flag = db.execute(
            text(
                """
                SELECT flag_id, session_id, resolution_status
                FROM flagged_sessions
                WHERE flag_id = :flag_id
                """
            ),
            {"flag_id": flag_id},
        ).mappings().first()
        if existing_flag is None:
            return None

        if existing_flag["resolution_status"] != "pending":
            raise ValueError("Flag has already been resolved")

        manager_exists = db.execute(
            text(
                """
                SELECT manager_id
                FROM managers
                WHERE manager_id = :manager_id
                """
            ),
            {"manager_id": payload.manager_id},
        ).scalar_one_or_none()
        if manager_exists is None:
            raise LookupError("Manager not found")

        if payload.action_taken == "approved" and len(payload.manager_justification_notes.strip()) < 4:
            raise ValueError("Approved resolution requires a more specific justification note")

        is_approved = payload.action_taken == "approved"
        db.execute(
            text(
                """
                UPDATE flagged_sessions
                SET resolution_status = :resolution_status,
                    leaderboard_points_revoked = :leaderboard_points_revoked,
                    streak_shield_locked = :streak_shield_locked,
                    module_completion_frozen = :module_completion_frozen
                WHERE flag_id = :flag_id
                """
            ),
            {
                "flag_id": flag_id,
                "resolution_status": payload.action_taken,
                "leaderboard_points_revoked": not is_approved,
                "streak_shield_locked": False,
                "module_completion_frozen": False,
            },
        )
        self._sync_session_penalties(db=db, session_id=str(existing_flag["session_id"]))
        db.execute(
            text(
                """
                INSERT INTO compliance_audit_log (
                  audit_id,
                  flag_id,
                  manager_id,
                  action_taken,
                  manager_justification_notes,
                  created_at
                ) VALUES (
                  :audit_id,
                  :flag_id,
                  :manager_id,
                  :action_taken,
                  :manager_justification_notes,
                  :created_at
                )
                """
            ),
            {
                "audit_id": str(uuid4()),
                "flag_id": flag_id,
                "manager_id": payload.manager_id,
                "action_taken": payload.action_taken,
                "manager_justification_notes": payload.manager_justification_notes,
                "created_at": datetime.now(timezone.utc),
            },
        )
        db.commit()
        return self.get_flag_detail(db=db, flag_id=flag_id)

    @staticmethod
    def _sync_session_penalties(db: Session, session_id: str) -> None:
        active_penalty = db.execute(
            text(
                """
                SELECT
                  BOOL_OR(resolution_status != 'approved') AS has_unapproved_flag,
                  BOOL_OR(resolution_status != 'approved' AND severity_level = 'high') AS has_unapproved_high_flag
                FROM flagged_sessions
                WHERE session_id = :session_id
                """
            ),
            {"session_id": session_id},
        ).mappings().one()
        has_unapproved_flag = bool(active_penalty["has_unapproved_flag"])
        has_unapproved_high_flag = bool(active_penalty["has_unapproved_high_flag"])

        db.execute(
            text(
                """
                UPDATE flagged_sessions
                SET leaderboard_points_revoked = resolution_status != 'approved',
                    streak_shield_locked = resolution_status != 'approved' AND severity_level = 'high',
                    module_completion_frozen = resolution_status != 'approved' AND severity_level = 'high'
                WHERE session_id = :session_id
                """
            ),
            {"session_id": session_id},
        )

        db.execute(
            text(
                """
                UPDATE learning_sessions
                SET leaderboard_points = :leaderboard_points,
                    weekly_reward_points = :weekly_reward_points,
                    streak_shield_locked = :streak_shield_locked,
                    module_completion_frozen = :module_completion_frozen
                WHERE session_id = :session_id
                """
            ),
            {
                "session_id": session_id,
                "leaderboard_points": 0 if has_unapproved_flag else BASE_MODULE_POINTS,
                "weekly_reward_points": 0 if has_unapproved_flag else WEEKLY_REVIEW_REWARD_POINTS,
                "streak_shield_locked": has_unapproved_high_flag,
                "module_completion_frozen": has_unapproved_high_flag,
            },
        )

    @staticmethod
    def _filter_items(
        items: list[FlagListItem],
        severity: str,
        status: str,
        query: str,
    ) -> list[FlagListItem]:
        lowered_query = query.strip().lower()
        result: list[FlagListItem] = []

        for item in items:
            matches_severity = severity == "all" or item.severity_level == severity
            matches_status = status == "all" or item.resolution_status == status
            haystack = " ".join(
                [
                    item.agent_name,
                    item.agent_id,
                    item.branch_name,
                    item.course_name,
                    item.rule_name,
                    item.rule_code,
                ]
            ).lower()
            matches_query = not lowered_query or lowered_query in haystack

            if matches_severity and matches_status and matches_query:
                result.append(item)

        return result

    @staticmethod
    def _build_flag_list_item(row: dict) -> FlagListItem:
        return FlagListItem(
            flag_id=str(row["flag_id"]),
            session_id=str(row["session_id"]),
            agent_id=row["agent_id"],
            agent_name=row["agent_name"],
            branch_name=row["branch_name"],
            course_id=row["course_id"],
            course_name=row["course_name"],
            rule_id=str(row["rule_id"]),
            rule_code=row["rule_code"],
            rule_name=row["rule_name"],
            severity_level=row["severity_level"],
            resolution_status=row["resolution_status"],
            flag_timestamp=row["flag_timestamp"].isoformat(),
            risk_reason=row["risk_reason"],
        )

    @staticmethod
    def _base_flags_query():
        return text(
            """
            SELECT
              fs.flag_id,
              fs.session_id,
              fs.agent_id,
              a.agent_name,
              a.branch_name,
              ls.course_id,
              c.course_name,
              cr.rule_id,
              cr.rule_code,
              cr.rule_name,
              cr.description AS rule_description,
              cr.parameter_json,
              fs.severity_level,
              fs.resolution_status,
              fs.flag_timestamp,
              fs.risk_reason,
              ls.started_at,
              ls.finished_at,
              ls.duration_seconds,
              ls.quiz_seconds,
              ls.quiz_score,
              ls.context_switch_count,
              ls.cards_swiped,
              ls.leaderboard_points,
              ls.weekly_reward_points,
              ls.streak_shield_locked AS session_streak_shield_locked,
              ls.module_completion_frozen
            FROM flagged_sessions fs
            JOIN agents a ON a.agent_id = fs.agent_id
            JOIN learning_sessions ls ON ls.session_id = fs.session_id
            JOIN courses c ON c.course_id = ls.course_id
            JOIN compliance_rules cr ON cr.rule_id = fs.rule_violated_id
            """
        )

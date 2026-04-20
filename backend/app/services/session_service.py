from datetime import datetime
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.schemas.session import (
    LeaderboardEntry,
    LeaderboardResponse,
    RecentSessionItem,
    RecentSessionsResponse,
    SessionFilterOption,
    SessionCreateRequest,
    SessionCreateResponse,
    SessionDetailResponse,
    SessionTimelineEntry,
)


class SessionService:
    def get_leaderboard(self, db: Session, limit: int = 10) -> LeaderboardResponse:
        rows = db.execute(
            text(
                """
                SELECT
                  a.agent_id,
                  a.agent_name,
                  a.branch_name,
                  COALESCE(SUM(ls.leaderboard_points), 0)::INTEGER AS leaderboard_points,
                  COALESCE(SUM(ls.weekly_reward_points), 0)::INTEGER AS weekly_reward_points,
                  COALESCE(SUM(ls.leaderboard_points + ls.weekly_reward_points), 0)::INTEGER AS total_points,
                  COUNT(ls.session_id) FILTER (WHERE ls.finished_at IS NOT NULL)::INTEGER AS completed_sessions,
                  COUNT(DISTINCT fs.session_id)::INTEGER AS flagged_sessions
                FROM agents a
                LEFT JOIN learning_sessions ls ON ls.agent_id = a.agent_id
                LEFT JOIN flagged_sessions fs ON fs.session_id = ls.session_id
                WHERE a.is_active = TRUE
                GROUP BY a.agent_id, a.agent_name, a.branch_name
                ORDER BY total_points DESC, completed_sessions DESC, a.agent_name ASC
                LIMIT :limit
                """
            ),
            {"limit": limit},
        ).mappings().all()

        return LeaderboardResponse(
            items=[
                LeaderboardEntry(
                    rank=index + 1,
                    agent_id=row["agent_id"],
                    agent_name=row["agent_name"],
                    branch_name=row["branch_name"],
                    leaderboard_points=row["leaderboard_points"],
                    weekly_reward_points=row["weekly_reward_points"],
                    total_points=row["total_points"],
                    completed_sessions=row["completed_sessions"],
                    flagged_sessions=row["flagged_sessions"],
                )
                for index, row in enumerate(rows)
            ]
        )

    def get_session_detail(self, db: Session, session_id: str) -> SessionDetailResponse | None:
        session_row = db.execute(
            self._recent_sessions_sql(where_clause="WHERE ls.session_id = :session_id", limit_clause=""),
            {"session_id": session_id},
        ).mappings().first()
        if session_row is None:
            return None

        timeline_rows = db.execute(
            text(
                """
                SELECT
                  event_id,
                  event_type,
                  event_timestamp,
                  metadata_json
                FROM session_events
                WHERE session_id = :session_id
                ORDER BY event_timestamp ASC
                """
            ),
            {"session_id": session_id},
        ).mappings().all()

        return SessionDetailResponse(
            session=self._build_recent_session_item(session_row),
            timeline=[
                SessionTimelineEntry(
                    event_id=str(row["event_id"]),
                    event_type=row["event_type"],
                    event_timestamp=row["event_timestamp"].isoformat(),
                    metadata_json=row["metadata_json"],
                )
                for row in timeline_rows
            ],
        )

    def list_recent_sessions(
        self,
        db: Session,
        limit: int = 10,
        agent_id: str = "",
        course_id: str = "",
    ) -> RecentSessionsResponse:
        where_clauses = []
        query_params: dict[str, object] = {"limit": limit}

        if agent_id:
            where_clauses.append("ls.agent_id = :agent_id")
            query_params["agent_id"] = agent_id
        if course_id:
            where_clauses.append("ls.course_id = :course_id")
            query_params["course_id"] = course_id

        where_clause = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        rows = db.execute(
            self._recent_sessions_sql(where_clause=where_clause, limit_clause="LIMIT :limit"),
            query_params,
        ).mappings().all()

        return RecentSessionsResponse(
            items=[self._build_recent_session_item(row) for row in rows],
            agent_options=self._list_agent_options(db),
            course_options=self._list_course_options(db),
        )

    def _recent_sessions_sql(self, where_clause: str = "", limit_clause: str = ""):
        return text(
            f"""
            SELECT
              ls.session_id,
              ls.agent_id,
              a.agent_name,
              a.branch_name,
              ls.course_id,
              c.course_name,
              ls.started_at,
              ls.finished_at,
              ls.duration_seconds,
              ls.quiz_seconds,
              ls.quiz_score,
              ls.context_switch_count,
              ls.cards_swiped,
              ls.leaderboard_points,
              ls.weekly_reward_points,
              ls.streak_shield_locked,
              ls.module_completion_frozen,
              COUNT(DISTINCT se.event_id) AS event_count,
              COUNT(DISTINCT fs.flag_id) AS flag_count,
              COALESCE(
                ARRAY_AGG(DISTINCT cr.rule_code) FILTER (WHERE cr.rule_code IS NOT NULL),
                ARRAY[]::VARCHAR[]
              ) AS flag_rule_codes,
              latest_event.event_type AS latest_event_type,
              latest_event.event_timestamp AS latest_event_at
            FROM learning_sessions ls
            JOIN agents a ON a.agent_id = ls.agent_id
            JOIN courses c ON c.course_id = ls.course_id
            LEFT JOIN session_events se ON se.session_id = ls.session_id
            LEFT JOIN flagged_sessions fs ON fs.session_id = ls.session_id
            LEFT JOIN compliance_rules cr ON cr.rule_id = fs.rule_violated_id
            LEFT JOIN LATERAL (
              SELECT event_type, event_timestamp
              FROM session_events
              WHERE session_id = ls.session_id
              ORDER BY event_timestamp DESC
              LIMIT 1
            ) latest_event ON TRUE
            {where_clause}
            GROUP BY
              ls.session_id,
              a.agent_name,
              a.branch_name,
              c.course_name,
              latest_event.event_type,
              latest_event.event_timestamp
            ORDER BY ls.created_at DESC
            {limit_clause}
            """
        )

    def _build_recent_session_item(self, row) -> RecentSessionItem:
        return RecentSessionItem(
            session_id=str(row["session_id"]),
            agent_id=row["agent_id"],
            agent_name=row["agent_name"],
            branch_name=row["branch_name"],
            course_id=row["course_id"],
            course_name=row["course_name"],
            started_at=row["started_at"].isoformat(),
            finished_at=row["finished_at"].isoformat() if row["finished_at"] else None,
            duration_seconds=row["duration_seconds"],
            quiz_seconds=row["quiz_seconds"],
            quiz_score=row["quiz_score"],
            context_switch_count=row["context_switch_count"],
            cards_swiped=row["cards_swiped"],
            leaderboard_points=row["leaderboard_points"],
            weekly_reward_points=row["weekly_reward_points"],
            streak_shield_locked=row["streak_shield_locked"],
            module_completion_frozen=row["module_completion_frozen"],
            event_count=row["event_count"],
            flag_count=row["flag_count"],
            flag_rule_codes=list(row["flag_rule_codes"] or []),
            latest_event_type=row["latest_event_type"],
            latest_event_at=row["latest_event_at"].isoformat() if row["latest_event_at"] else None,
            session_status="normal" if row["flag_count"] == 0 else "flagged",
        )

    def _list_agent_options(self, db: Session) -> list[SessionFilterOption]:
        rows = db.execute(
            text(
                """
                SELECT agent_id, agent_name, branch_name
                FROM agents
                WHERE is_active = TRUE
                ORDER BY branch_name ASC, agent_name ASC
                """
            )
        ).mappings().all()

        return [
            SessionFilterOption(
                value=row["agent_id"],
                label=f'{row["agent_name"]}｜{row["branch_name"]}｜{row["agent_id"]}',
            )
            for row in rows
        ]

    def _list_course_options(self, db: Session) -> list[SessionFilterOption]:
        rows = db.execute(
            text(
                """
                SELECT course_id, course_name
                FROM courses
                WHERE is_active = TRUE
                ORDER BY course_name ASC
                """
            )
        ).mappings().all()

        return [
            SessionFilterOption(
                value=row["course_id"],
                label=f'{row["course_name"]}｜{row["course_id"]}',
            )
            for row in rows
        ]

    def create_session(self, db: Session, payload: SessionCreateRequest) -> SessionCreateResponse | None:
        agent_exists = db.execute(
            text(
                """
                SELECT agent_id
                FROM agents
                WHERE agent_id = :agent_id
                  AND is_active = TRUE
                """
            ),
            {"agent_id": payload.agent_id},
        ).scalar_one_or_none()
        if agent_exists is None:
            raise LookupError("Agent not found")

        course_exists = db.execute(
            text(
                """
                SELECT course_id
                FROM courses
                WHERE course_id = :course_id
                  AND is_active = TRUE
                """
            ),
            {"course_id": payload.course_id},
        ).scalar_one_or_none()
        if course_exists is None:
            raise LookupError("Course not found")

        parsed_started_at = datetime.fromisoformat(payload.started_at)
        session_id = str(uuid4())

        db.execute(
            text(
                """
                INSERT INTO learning_sessions (
                  session_id,
                  agent_id,
                  course_id,
                  started_at,
                  context_switch_count,
                  cards_swiped,
                  leaderboard_points,
                  weekly_reward_points,
                  streak_shield_locked,
                  module_completion_frozen
                ) VALUES (
                  :session_id,
                  :agent_id,
                  :course_id,
                  :started_at,
                  0,
                  0,
                  0,
                  0,
                  FALSE,
                  FALSE
                )
                """
            ),
            {
                "session_id": session_id,
                "agent_id": payload.agent_id,
                "course_id": payload.course_id,
                "started_at": parsed_started_at,
            },
        )
        db.commit()

        return SessionCreateResponse(
            session_id=session_id,
            agent_id=payload.agent_id,
            course_id=payload.course_id,
            started_at=parsed_started_at.isoformat(),
            finished_at=None,
            duration_seconds=None,
            context_switch_count=0,
            cards_swiped=0,
            leaderboard_points=0,
            weekly_reward_points=0,
            streak_shield_locked=False,
            module_completion_frozen=False,
        )

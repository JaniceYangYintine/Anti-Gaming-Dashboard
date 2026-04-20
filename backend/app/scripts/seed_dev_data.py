from datetime import datetime, timedelta, timezone

from sqlalchemy import text

from app.db.session import SessionLocal


DEMO_SESSIONS = {
    "speed_run": "11111111-1111-1111-1111-111111111111",
    "blind_guess": "22222222-2222-2222-2222-222222222222",
    "context_switch": "33333333-3333-3333-3333-333333333333",
}

DEMO_FLAGS = {
    "speed_run": "aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaa1",
    "blind_guess": "bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbb2",
    "context_switch": "ccccccc3-cccc-cccc-cccc-ccccccccccc3",
}

DEMO_AUDITS = {
    "blind_guess": "ddddddd4-dddd-dddd-dddd-ddddddddddd4",
}


def seed_dev_data() -> None:
    db = SessionLocal()
    now = datetime.now(timezone.utc).replace(microsecond=0)

    try:
        rule_rows = db.execute(
            text(
                """
                SELECT rule_id, rule_code, severity_level
                FROM compliance_rules
                """
            )
        ).mappings().all()
        rule_map = {row["rule_code"]: row for row in rule_rows}

        if len(rule_map) < 3:
            raise RuntimeError("compliance_rules is incomplete. Please import schema.sql first.")

        _cleanup_existing_demo_data(db=db)
        _insert_learning_sessions(db=db, now=now)
        _insert_session_events(db=db, now=now)
        _insert_flagged_sessions(db=db, now=now, rule_map=rule_map)
        _insert_audit_logs(db=db, now=now)

        db.commit()
        print("Seed data inserted successfully with deterministic demo sessions.")
    finally:
        db.close()


def _cleanup_existing_demo_data(db) -> None:
    session_ids = tuple(DEMO_SESSIONS.values())
    flag_ids = tuple(DEMO_FLAGS.values())

    db.execute(
        text(
            """
            DELETE FROM flagged_sessions
            WHERE (
                flag_id = ANY(CAST(:flag_ids AS uuid[]))
                OR session_id = ANY(CAST(:session_ids AS uuid[]))
              )
              AND NOT EXISTS (
                SELECT 1
                FROM compliance_audit_log cal
                WHERE cal.flag_id = flagged_sessions.flag_id
              )
            """
        ),
        {"flag_ids": list(flag_ids), "session_ids": list(session_ids)},
    )
    db.execute(
        text(
            """
            DELETE FROM session_events
            WHERE session_id = ANY(CAST(:session_ids AS uuid[]))
              AND NOT EXISTS (
                SELECT 1
                FROM compliance_audit_log cal
                JOIN flagged_sessions fs ON fs.flag_id = cal.flag_id
                WHERE fs.session_id = session_events.session_id
              )
            """
        ),
        {"session_ids": list(session_ids)},
    )
    db.execute(
        text(
            """
            DELETE FROM learning_sessions
            WHERE session_id = ANY(CAST(:session_ids AS uuid[]))
              AND NOT EXISTS (
                SELECT 1
                FROM compliance_audit_log cal
                JOIN flagged_sessions fs ON fs.flag_id = cal.flag_id
                WHERE fs.session_id = learning_sessions.session_id
              )
            """
        ),
        {"session_ids": list(session_ids)},
    )


def _insert_learning_sessions(db, now: datetime) -> None:
    db.execute(
        text(
            """
            INSERT INTO learning_sessions (
              session_id,
              agent_id,
              course_id,
              started_at,
              finished_at,
              duration_seconds,
              quiz_seconds,
              quiz_score,
              context_switch_count,
              cards_swiped,
              leaderboard_points,
              weekly_reward_points,
              streak_shield_locked,
              module_completion_frozen
            ) VALUES
              (:speed_run_session, 'A1028', 'COURSE-AML-101', :speed_run_start, :speed_run_end, 12, 3, 100, 2, 5, 0, 0, TRUE, TRUE),
              (:blind_guess_session, 'A2041', 'COURSE-INV-230', :blind_guess_start, :blind_guess_end, 415, 4, 0, 1, 8, 100, 10, FALSE, FALSE),
              (:context_switch_session, 'A3350', 'COURSE-CROSS-120', :context_switch_start, :context_switch_end, 450, 38, 80, 7, 9, 0, 0, TRUE, TRUE)
            ON CONFLICT (session_id) DO NOTHING
            """
        ),
        {
            "speed_run_session": DEMO_SESSIONS["speed_run"],
            "blind_guess_session": DEMO_SESSIONS["blind_guess"],
            "context_switch_session": DEMO_SESSIONS["context_switch"],
            "speed_run_start": now - timedelta(hours=5),
            "speed_run_end": now - timedelta(hours=5) + timedelta(seconds=12),
            "blind_guess_start": now - timedelta(hours=4),
            "blind_guess_end": now - timedelta(hours=4) + timedelta(seconds=415),
            "context_switch_start": now - timedelta(hours=3),
            "context_switch_end": now - timedelta(hours=3) + timedelta(seconds=450),
        },
    )


def _insert_session_events(db, now: datetime) -> None:
    speed_start = now - timedelta(hours=5)
    blind_start = now - timedelta(hours=4)
    switch_start = now - timedelta(hours=3)

    event_rows = [
        {
            "event_id": "10000000-0000-0000-0000-000000000001",
            "session_id": DEMO_SESSIONS["speed_run"],
            "event_type": "session_started",
            "event_timestamp": speed_start,
            "metadata_json": '{"source":"seed_demo"}',
        },
        {
            "event_id": "10000000-0000-0000-0000-000000000002",
            "session_id": DEMO_SESSIONS["speed_run"],
            "event_type": "card_swiped",
            "event_timestamp": speed_start + timedelta(seconds=2),
            "metadata_json": '{"card_index":1}',
        },
        {
            "event_id": "10000000-0000-0000-0000-000000000003",
            "session_id": DEMO_SESSIONS["speed_run"],
            "event_type": "quiz_submitted",
            "event_timestamp": speed_start + timedelta(seconds=11),
            "metadata_json": '{"quiz_seconds":3,"quiz_score":100}',
        },
        {
            "event_id": "10000000-0000-0000-0000-000000000004",
            "session_id": DEMO_SESSIONS["speed_run"],
            "event_type": "session_completed",
            "event_timestamp": speed_start + timedelta(seconds=12),
            "metadata_json": '{"source":"seed_demo"}',
        },
        {
            "event_id": "20000000-0000-0000-0000-000000000001",
            "session_id": DEMO_SESSIONS["blind_guess"],
            "event_type": "session_started",
            "event_timestamp": blind_start,
            "metadata_json": '{"source":"seed_demo"}',
        },
        {
            "event_id": "20000000-0000-0000-0000-000000000002",
            "session_id": DEMO_SESSIONS["blind_guess"],
            "event_type": "card_swiped",
            "event_timestamp": blind_start + timedelta(seconds=120),
            "metadata_json": '{"card_index":5}',
        },
        {
            "event_id": "20000000-0000-0000-0000-000000000003",
            "session_id": DEMO_SESSIONS["blind_guess"],
            "event_type": "quiz_submitted",
            "event_timestamp": blind_start + timedelta(seconds=414),
            "metadata_json": '{"quiz_seconds":4,"quiz_score":0}',
        },
        {
            "event_id": "20000000-0000-0000-0000-000000000004",
            "session_id": DEMO_SESSIONS["blind_guess"],
            "event_type": "session_completed",
            "event_timestamp": blind_start + timedelta(seconds=415),
            "metadata_json": '{"source":"seed_demo"}',
        },
        {
            "event_id": "30000000-0000-0000-0000-000000000001",
            "session_id": DEMO_SESSIONS["context_switch"],
            "event_type": "session_started",
            "event_timestamp": switch_start,
            "metadata_json": '{"source":"seed_demo"}',
        },
        {
            "event_id": "30000000-0000-0000-0000-000000000002",
            "session_id": DEMO_SESSIONS["context_switch"],
            "event_type": "context_switch",
            "event_timestamp": switch_start + timedelta(seconds=30),
            "metadata_json": '{"target":"line_app","source":"seed_demo"}',
        },
        {
            "event_id": "30000000-0000-0000-0000-000000000003",
            "session_id": DEMO_SESSIONS["context_switch"],
            "event_type": "context_switch",
            "event_timestamp": switch_start + timedelta(seconds=75),
            "metadata_json": '{"target":"mail_app","source":"seed_demo"}',
        },
        {
            "event_id": "30000000-0000-0000-0000-000000000004",
            "session_id": DEMO_SESSIONS["context_switch"],
            "event_type": "context_switch",
            "event_timestamp": switch_start + timedelta(seconds=140),
            "metadata_json": '{"target":"line_app","source":"seed_demo"}',
        },
        {
            "event_id": "30000000-0000-0000-0000-000000000005",
            "session_id": DEMO_SESSIONS["context_switch"],
            "event_type": "context_switch",
            "event_timestamp": switch_start + timedelta(seconds=210),
            "metadata_json": '{"target":"browser","source":"seed_demo"}',
        },
        {
            "event_id": "30000000-0000-0000-0000-000000000006",
            "session_id": DEMO_SESSIONS["context_switch"],
            "event_type": "context_switch",
            "event_timestamp": switch_start + timedelta(seconds=260),
            "metadata_json": '{"target":"line_app","source":"seed_demo"}',
        },
        {
            "event_id": "30000000-0000-0000-0000-000000000007",
            "session_id": DEMO_SESSIONS["context_switch"],
            "event_type": "context_switch",
            "event_timestamp": switch_start + timedelta(seconds=320),
            "metadata_json": '{"target":"mail_app","source":"seed_demo"}',
        },
        {
            "event_id": "30000000-0000-0000-0000-000000000008",
            "session_id": DEMO_SESSIONS["context_switch"],
            "event_type": "context_switch",
            "event_timestamp": switch_start + timedelta(seconds=400),
            "metadata_json": '{"target":"browser","source":"seed_demo"}',
        },
        {
            "event_id": "30000000-0000-0000-0000-000000000009",
            "session_id": DEMO_SESSIONS["context_switch"],
            "event_type": "quiz_submitted",
            "event_timestamp": switch_start + timedelta(seconds=430),
            "metadata_json": '{"quiz_seconds":38,"quiz_score":80}',
        },
        {
            "event_id": "30000000-0000-0000-0000-000000000010",
            "session_id": DEMO_SESSIONS["context_switch"],
            "event_type": "session_completed",
            "event_timestamp": switch_start + timedelta(seconds=450),
            "metadata_json": '{"source":"seed_demo"}',
        },
    ]

    for row in event_rows:
        db.execute(
            text(
                """
                INSERT INTO session_events (
                  event_id,
                  session_id,
                  event_type,
                  event_timestamp,
                  metadata_json
                ) VALUES (
                  :event_id,
                  :session_id,
                  :event_type,
                  :event_timestamp,
                  CAST(:metadata_json AS jsonb)
                )
                ON CONFLICT (event_id) DO NOTHING
                """
            ),
            row,
        )


def _insert_flagged_sessions(db, now: datetime, rule_map: dict) -> None:
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
              streak_shield_locked,
              module_completion_frozen
            ) VALUES
              (
                :speed_run_flag,
                :speed_run_session,
                'A1028',
                :speed_rule_id,
                :speed_time,
                'pending',
                :speed_severity,
                '12 秒完成 7 分鐘課程，疑似不可能的完成速度。',
                TRUE,
                TRUE,
                TRUE
              ),
              (
                :blind_guess_flag,
                :blind_guess_session,
                'A2041',
                :blind_rule_id,
                :blind_time,
                'approved',
                :blind_severity,
                '4 秒完成測驗且得分為 0，疑似盲猜略過作答。',
                FALSE,
                FALSE,
                FALSE
              ),
              (
                :context_switch_flag,
                :context_switch_session,
                'A3350',
                :switch_rule_id,
                :switch_time,
                'pending',
                :switch_severity,
                '7 分鐘內切換視窗 7 次，超過規則門檻。',
                TRUE,
                TRUE,
                TRUE
              )
            ON CONFLICT (flag_id) DO NOTHING
            """
        ),
        {
            "speed_run_flag": DEMO_FLAGS["speed_run"],
            "blind_guess_flag": DEMO_FLAGS["blind_guess"],
            "context_switch_flag": DEMO_FLAGS["context_switch"],
            "speed_run_session": DEMO_SESSIONS["speed_run"],
            "blind_guess_session": DEMO_SESSIONS["blind_guess"],
            "context_switch_session": DEMO_SESSIONS["context_switch"],
            "speed_rule_id": rule_map["IMPOSSIBLE_SPEED"]["rule_id"],
            "blind_rule_id": rule_map["BLIND_GUESSING"]["rule_id"],
            "switch_rule_id": rule_map["EXCESSIVE_CONTEXT_SWITCH"]["rule_id"],
            "speed_severity": rule_map["IMPOSSIBLE_SPEED"]["severity_level"],
            "blind_severity": rule_map["BLIND_GUESSING"]["severity_level"],
            "switch_severity": rule_map["EXCESSIVE_CONTEXT_SWITCH"]["severity_level"],
            "speed_time": now - timedelta(hours=5) + timedelta(seconds=13),
            "blind_time": now - timedelta(hours=4) + timedelta(seconds=416),
            "switch_time": now - timedelta(hours=3) + timedelta(seconds=451),
        },
    )


def _insert_audit_logs(db, now: datetime) -> None:
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
              'M208',
              'approved',
              '經主管複核，此案例為測驗頁面延遲造成的誤判，先解除鎖定並保留紀錄。',
              :created_at
            )
            ON CONFLICT (audit_id) DO NOTHING
            """
        ),
        {
            "audit_id": DEMO_AUDITS["blind_guess"],
            "flag_id": DEMO_FLAGS["blind_guess"],
            "created_at": now - timedelta(hours=2, minutes=45),
        },
    )


if __name__ == "__main__":
    seed_dev_data()

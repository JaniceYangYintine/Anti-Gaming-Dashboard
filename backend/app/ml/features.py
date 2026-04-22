DECISION_TREE_FEATURE_NAMES = [
    "duration_seconds",
    "quiz_seconds",
    "quiz_score",
    "wrong_count",
    "answer_change_count",
    "max_answer_changes_per_question",
    "hidden_count",
    "focus_ratio",
    "total_input_events",
    "active_ratio",
    "face_absent_seconds",
    "longest_face_absence_seconds",
    "absence_count",
    "multiple_faces_seconds",
    "multiple_faces_detected_count",
]


def build_decision_tree_features(session_row: dict, event_metrics: dict) -> dict[str, float]:
    duration_seconds = float(session_row["duration_seconds"] or 0)
    quiz_seconds = float(session_row["quiz_seconds"] or 0)
    quiz_score = float(session_row["quiz_score"] or 0)
    hidden_count = float(max(event_metrics["hidden_count"], session_row["context_switch_count"] or 0))
    focused_seconds = float(event_metrics["focused_seconds"] or 0)
    total_input_events = float(
        event_metrics["mouse_move_count"]
        + event_metrics["mouse_click_count"]
        + event_metrics["mouse_scroll_count"]
        + event_metrics["keyboard_keydown_count"]
    )
    active_milliseconds = float(
        event_metrics["mouse_active_milliseconds"] + event_metrics["keyboard_active_milliseconds"]
    )
    question_change_counts = event_metrics["question_change_counts"] or {}

    focus_ratio = focused_seconds / duration_seconds if duration_seconds > 0 and focused_seconds > 0 else 0.0
    active_ratio = active_milliseconds / (duration_seconds * 1000) if duration_seconds > 0 else 0.0

    return {
        "duration_seconds": duration_seconds,
        "quiz_seconds": quiz_seconds,
        "quiz_score": quiz_score,
        "wrong_count": float(event_metrics["wrong_count"]),
        "answer_change_count": float(event_metrics["total_answer_changes"]),
        "max_answer_changes_per_question": float(max(question_change_counts.values(), default=0)),
        "hidden_count": hidden_count,
        "focus_ratio": focus_ratio,
        "total_input_events": total_input_events,
        "active_ratio": active_ratio,
        "face_absent_seconds": float(event_metrics["face_absent_seconds"]),
        "longest_face_absence_seconds": float(event_metrics["longest_face_absence_seconds"]),
        "absence_count": float(event_metrics["absence_count"]),
        "multiple_faces_seconds": float(event_metrics["multiple_faces_seconds"]),
        "multiple_faces_detected_count": float(event_metrics["multiple_faces_detected_count"]),
    }


def feature_vector(feature_values: dict[str, float], feature_names: list[str] | None = None) -> list[float]:
    names = feature_names or DECISION_TREE_FEATURE_NAMES
    return [float(feature_values.get(name, 0.0)) for name in names]

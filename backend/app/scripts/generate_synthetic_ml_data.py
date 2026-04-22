import csv
import random
from pathlib import Path

from app.ml.features import DECISION_TREE_FEATURE_NAMES


OUTPUT_PATH = Path(__file__).resolve().parents[1] / "ml" / "data" / "synthetic_sessions.csv"
ROW_COUNT = 5000
RANDOM_SEED = 20260423


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def generate_row() -> dict[str, float | int]:
    archetype = random.choices(
        ["normal", "fast", "blind_guess", "low_focus", "low_input", "camera_absent", "multiple_faces", "mixed"],
        weights=[48, 8, 8, 10, 8, 7, 4, 7],
        k=1,
    )[0]

    duration_seconds = random.randint(240, 720)
    quiz_seconds = random.randint(45, 210)
    quiz_score = random.randint(70, 100)
    wrong_count = max(0, round((100 - quiz_score) / 10))
    answer_change_count = random.randint(0, 4)
    max_answer_changes_per_question = min(answer_change_count, random.randint(0, 3))
    hidden_count = random.randint(0, 2)
    focus_ratio = round(random.uniform(0.78, 1.0), 3)
    total_input_events = random.randint(35, 220)
    active_ratio = round(random.uniform(0.08, 0.35), 3)
    face_absent_seconds = random.randint(0, 20)
    longest_face_absence_seconds = min(face_absent_seconds, random.randint(0, 12))
    absence_count = random.randint(0, 2)
    multiple_faces_seconds = 0
    multiple_faces_detected_count = 0

    if archetype == "fast":
        duration_seconds = random.randint(8, 45)
        quiz_seconds = random.randint(4, 35)
        quiz_score = random.randint(70, 100)
        wrong_count = max(0, round((100 - quiz_score) / 10))
    elif archetype == "blind_guess":
        duration_seconds = random.randint(8, 70)
        quiz_seconds = random.randint(3, 28)
        quiz_score = random.randint(0, 35)
        wrong_count = random.randint(7, 10)
    elif archetype == "low_focus":
        hidden_count = random.randint(4, 10)
        focus_ratio = round(random.uniform(0.25, 0.68), 3)
        duration_seconds = random.randint(180, 650)
    elif archetype == "low_input":
        duration_seconds = random.randint(420, 900)
        total_input_events = random.randint(0, 18)
        active_ratio = round(random.uniform(0.0, 0.075), 3)
    elif archetype == "camera_absent":
        face_absent_seconds = random.randint(35, 110)
        longest_face_absence_seconds = random.randint(18, min(face_absent_seconds, 70))
        absence_count = random.randint(1, 4)
    elif archetype == "multiple_faces":
        multiple_faces_seconds = random.randint(8, 35)
        multiple_faces_detected_count = random.randint(1, 4)
    elif archetype == "mixed":
        duration_seconds = random.randint(90, 360)
        quiz_seconds = random.randint(25, 80)
        wrong_count = random.randint(3, 8)
        quiz_score = max(0, 100 - wrong_count * 10)
        answer_change_count = random.randint(4, 12)
        max_answer_changes_per_question = random.randint(3, 9)
        hidden_count = random.randint(2, 6)
        focus_ratio = round(random.uniform(0.45, 0.75), 3)
        total_input_events = random.randint(8, 45)
        active_ratio = round(random.uniform(0.02, 0.12), 3)
        face_absent_seconds = random.randint(15, 65)
        longest_face_absence_seconds = random.randint(8, min(face_absent_seconds, 30))

    risk_score = (
        1.3 * (1 if quiz_seconds <= 30 and wrong_count <= 5 else 0)
        + 1.1 * (1 if quiz_seconds <= 30 and wrong_count >= 7 else 0)
        + 0.95 * clamp(answer_change_count / 10, 0, 1)
        + 1.05 * max(clamp(hidden_count / 6, 0, 1), clamp((0.6 - focus_ratio) / 0.6, 0, 1))
        + 0.85 * max(clamp((15 - total_input_events) / 15, 0, 1), clamp((0.08 - active_ratio) / 0.08, 0, 1))
        + 1.15 * max(clamp(face_absent_seconds / 60, 0, 1), clamp(longest_face_absence_seconds / 20, 0, 1))
        + 1.10 * max(clamp(multiple_faces_seconds / 10, 0, 1), clamp(multiple_faces_detected_count, 0, 1))
    )
    label = int(risk_score >= 1.0 or (archetype != "normal" and random.random() < 0.68))
    if archetype == "normal" and random.random() < 0.96:
        label = 0

    return {
        "duration_seconds": duration_seconds,
        "quiz_seconds": quiz_seconds,
        "quiz_score": quiz_score,
        "wrong_count": wrong_count,
        "answer_change_count": answer_change_count,
        "max_answer_changes_per_question": max_answer_changes_per_question,
        "hidden_count": hidden_count,
        "focus_ratio": focus_ratio,
        "total_input_events": total_input_events,
        "active_ratio": active_ratio,
        "face_absent_seconds": face_absent_seconds,
        "longest_face_absence_seconds": longest_face_absence_seconds,
        "absence_count": absence_count,
        "multiple_faces_seconds": multiple_faces_seconds,
        "multiple_faces_detected_count": multiple_faces_detected_count,
        "label": label,
    }


def main() -> None:
    random.seed(RANDOM_SEED)
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    rows = [generate_row() for _ in range(ROW_COUNT)]
    with OUTPUT_PATH.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=[*DECISION_TREE_FEATURE_NAMES, "label"])
        writer.writeheader()
        writer.writerows(rows)
    positive_count = sum(int(row["label"]) for row in rows)
    print(f"Wrote {len(rows)} rows to {OUTPUT_PATH}")
    print(f"Positive labels: {positive_count} ({positive_count / len(rows):.1%})")


if __name__ == "__main__":
    main()

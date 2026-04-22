import csv
import json
import math
import random
from collections import Counter
from pathlib import Path

from app.ml.features import DECISION_TREE_FEATURE_NAMES


DATA_PATH = Path(__file__).resolve().parents[1] / "ml" / "data" / "synthetic_sessions.csv"
ARTIFACT_DIR = Path(__file__).resolve().parents[1] / "ml" / "artifacts"
MODEL_PATH = ARTIFACT_DIR / "decision_tree_model.json"
METRICS_PATH = ARTIFACT_DIR / "decision_tree_metrics.json"
RULES_PATH = ARTIFACT_DIR / "decision_tree_rules.txt"
RANDOM_SEED = 20260423
MAX_DEPTH = 4
MIN_SAMPLES_LEAF = 45
DECISION_THRESHOLD = 0.5


def load_rows(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as csv_file:
        return [
            {
                **{name: float(row[name]) for name in DECISION_TREE_FEATURE_NAMES},
                "label": int(row["label"]),
            }
            for row in csv.DictReader(csv_file)
        ]


def stratified_split(rows: list[dict]) -> tuple[list[dict], list[dict], list[dict]]:
    random.seed(RANDOM_SEED)
    by_label = {0: [], 1: []}
    for row in rows:
        by_label[row["label"]].append(row)
    for items in by_label.values():
        random.shuffle(items)

    train, validation, test = [], [], []
    for items in by_label.values():
        train_end = int(len(items) * 0.70)
        validation_end = int(len(items) * 0.85)
        train.extend(items[:train_end])
        validation.extend(items[train_end:validation_end])
        test.extend(items[validation_end:])

    random.shuffle(train)
    random.shuffle(validation)
    random.shuffle(test)
    return train, validation, test


def gini(rows: list[dict]) -> float:
    if not rows:
        return 0.0
    counts = Counter(row["label"] for row in rows)
    return 1 - sum((count / len(rows)) ** 2 for count in counts.values())


def candidate_thresholds(rows: list[dict], feature_name: str) -> list[float]:
    values = sorted({row[feature_name] for row in rows})
    if len(values) <= 1:
        return []
    thresholds = [(left + right) / 2 for left, right in zip(values, values[1:])]
    if len(thresholds) > 80:
        step = max(1, len(thresholds) // 80)
        thresholds = thresholds[::step]
    return thresholds


def find_best_split(rows: list[dict]) -> tuple[str, float, float] | None:
    parent_impurity = gini(rows)
    best = None
    for feature_name in DECISION_TREE_FEATURE_NAMES:
        for threshold in candidate_thresholds(rows, feature_name):
            left = [row for row in rows if row[feature_name] <= threshold]
            right = [row for row in rows if row[feature_name] > threshold]
            if len(left) < MIN_SAMPLES_LEAF or len(right) < MIN_SAMPLES_LEAF:
                continue
            weighted_impurity = (len(left) / len(rows)) * gini(left) + (len(right) / len(rows)) * gini(right)
            gain = parent_impurity - weighted_impurity
            if best is None or gain > best[2]:
                best = (feature_name, threshold, gain)
    return best


def make_leaf(rows: list[dict], depth: int) -> dict:
    positive_rate = sum(row["label"] for row in rows) / len(rows) if rows else 0.0
    return {
        "type": "leaf",
        "depth": depth,
        "samples": len(rows),
        "positive_rate": round(positive_rate, 4),
        "prediction": int(positive_rate >= DECISION_THRESHOLD),
    }


def build_tree(rows: list[dict], depth: int = 0) -> dict:
    positive_rate = sum(row["label"] for row in rows) / len(rows) if rows else 0.0
    if depth >= MAX_DEPTH or len(rows) < MIN_SAMPLES_LEAF * 2 or positive_rate in {0.0, 1.0}:
        return make_leaf(rows, depth)

    split = find_best_split(rows)
    if split is None or split[2] <= 0:
        return make_leaf(rows, depth)

    feature_name, threshold, gain = split
    left = [row for row in rows if row[feature_name] <= threshold]
    right = [row for row in rows if row[feature_name] > threshold]
    return {
        "type": "node",
        "depth": depth,
        "feature": feature_name,
        "threshold": round(threshold, 4),
        "gini_gain": round(gain, 6),
        "samples": len(rows),
        "positive_rate": round(positive_rate, 4),
        "left": build_tree(left, depth + 1),
        "right": build_tree(right, depth + 1),
    }


def predict_row(tree: dict, row: dict) -> tuple[int, float]:
    node = tree
    while node["type"] != "leaf":
        node = node["left"] if row[node["feature"]] <= node["threshold"] else node["right"]
    score = float(node["positive_rate"])
    return int(score >= DECISION_THRESHOLD), score


def evaluate(tree: dict, rows: list[dict]) -> dict:
    tp = fp = tn = fn = 0
    losses = []
    for row in rows:
        prediction, score = predict_row(tree, row)
        label = row["label"]
        clipped_score = min(0.999, max(0.001, score))
        losses.append(-(label * math.log(clipped_score) + (1 - label) * math.log(1 - clipped_score)))
        if prediction == 1 and label == 1:
            tp += 1
        elif prediction == 1 and label == 0:
            fp += 1
        elif prediction == 0 and label == 0:
            tn += 1
        else:
            fn += 1
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    return {
        "rows": len(rows),
        "accuracy": round((tp + tn) / len(rows), 4) if rows else 0.0,
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(2 * precision * recall / (precision + recall), 4) if precision + recall else 0.0,
        "log_loss": round(sum(losses) / len(losses), 4) if losses else 0.0,
        "confusion_matrix": {"tp": tp, "fp": fp, "tn": tn, "fn": fn},
    }


def render_rules(node: dict, prefix: list[str] | None = None) -> list[str]:
    prefix = prefix or []
    if node["type"] == "leaf":
        rule = " AND ".join(prefix) if prefix else "ALL"
        return [
            f"IF {rule} THEN prediction={node['prediction']} "
            f"positive_rate={node['positive_rate']} samples={node['samples']}"
        ]
    left_rule = f"{node['feature']} <= {node['threshold']}"
    right_rule = f"{node['feature']} > {node['threshold']}"
    return render_rules(node["left"], [*prefix, left_rule]) + render_rules(node["right"], [*prefix, right_rule])


def main() -> None:
    rows = load_rows(DATA_PATH)
    train, validation, test = stratified_split(rows)
    tree = build_tree(train)
    metrics = {
        "dataset": {
            "source": str(DATA_PATH),
            "kind": "synthetic",
            "total_rows": len(rows),
            "train_rows": len(train),
            "validation_rows": len(validation),
            "test_rows": len(test),
        },
        "model": {
            "model_name": "decision_tree",
            "model_version": "synthetic-poc-v1",
            "max_depth": MAX_DEPTH,
            "min_samples_leaf": MIN_SAMPLES_LEAF,
            "decision_threshold": DECISION_THRESHOLD,
        },
        "train": evaluate(tree, train),
        "validation": evaluate(tree, validation),
        "test": evaluate(tree, test),
        "disclaimer": (
            "This model is trained on synthetic data for PoC/demo only. "
            "Production use requires real labeled supervisor review outcomes."
        ),
    }
    artifact = {
        "model_name": "decision_tree",
        "model_version": "synthetic-poc-v1",
        "feature_names": DECISION_TREE_FEATURE_NAMES,
        "decision_threshold": DECISION_THRESHOLD,
        "tree": tree,
        "metrics": metrics,
    }

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    MODEL_PATH.write_text(json.dumps(artifact, ensure_ascii=False, indent=2), encoding="utf-8")
    METRICS_PATH.write_text(json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8")
    RULES_PATH.write_text("\n".join(render_rules(tree)) + "\n", encoding="utf-8")
    print(json.dumps(metrics, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

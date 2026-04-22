import csv
import json
from pathlib import Path

from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, log_loss, precision_score, recall_score
from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier

from app.ml.features import DECISION_TREE_FEATURE_NAMES


DATA_PATH = Path(__file__).resolve().parents[1] / "ml" / "data" / "synthetic_sessions.csv"
ARTIFACT_DIR = Path(__file__).resolve().parents[1] / "ml" / "artifacts"
MODEL_PATH = ARTIFACT_DIR / "decision_tree_model_sklearn.json"
METRICS_PATH = ARTIFACT_DIR / "decision_tree_metrics_sklearn.json"
RULES_PATH = ARTIFACT_DIR / "decision_tree_rules_sklearn.txt"
RANDOM_SEED = 20260423
MAX_DEPTH = 4
MIN_SAMPLES_LEAF = 45
DECISION_THRESHOLD = 0.5


def load_dataset() -> tuple[list[list[float]], list[int]]:
    features = []
    labels = []
    with DATA_PATH.open(encoding="utf-8") as csv_file:
        reader = csv.DictReader(csv_file)
        for row in reader:
            features.append([float(row[name]) for name in DECISION_TREE_FEATURE_NAMES])
            labels.append(int(row["label"]))
    return features, labels


def split_dataset(features: list[list[float]], labels: list[int]) -> tuple:
    x_train, x_temp, y_train, y_temp = train_test_split(
        features,
        labels,
        test_size=0.30,
        random_state=RANDOM_SEED,
        stratify=labels,
    )
    x_validation, x_test, y_validation, y_test = train_test_split(
        x_temp,
        y_temp,
        test_size=0.50,
        random_state=RANDOM_SEED,
        stratify=y_temp,
    )
    return x_train, y_train, x_validation, y_validation, x_test, y_test


def evaluate(model: DecisionTreeClassifier, features: list[list[float]], labels: list[int]) -> dict:
    predictions = model.predict(features)
    probabilities = model.predict_proba(features)[:, 1]
    tn, fp, fn, tp = confusion_matrix(labels, predictions, labels=[0, 1]).ravel()
    return {
        "rows": len(labels),
        "accuracy": round(accuracy_score(labels, predictions), 4),
        "precision": round(precision_score(labels, predictions, zero_division=0), 4),
        "recall": round(recall_score(labels, predictions, zero_division=0), 4),
        "f1": round(f1_score(labels, predictions, zero_division=0), 4),
        "log_loss": round(log_loss(labels, probabilities, labels=[0, 1]), 4),
        "confusion_matrix": {
            "tp": int(tp),
            "fp": int(fp),
            "tn": int(tn),
            "fn": int(fn),
        },
    }


def export_tree(model: DecisionTreeClassifier, node_id: int = 0, depth: int = 0) -> dict:
    tree = model.tree_
    left_child = int(tree.children_left[node_id])
    right_child = int(tree.children_right[node_id])
    sample_count = int(tree.n_node_samples[node_id])
    class_counts = tree.value[node_id][0]
    total_count = float(class_counts.sum())
    positive_rate = float(class_counts[1] / total_count) if total_count else 0.0

    if left_child == right_child:
        return {
            "type": "leaf",
            "depth": depth,
            "samples": sample_count,
            "positive_rate": round(positive_rate, 4),
            "prediction": int(positive_rate >= DECISION_THRESHOLD),
        }

    feature_index = int(tree.feature[node_id])
    return {
        "type": "node",
        "depth": depth,
        "feature": DECISION_TREE_FEATURE_NAMES[feature_index],
        "threshold": round(float(tree.threshold[node_id]), 4),
        "samples": sample_count,
        "positive_rate": round(positive_rate, 4),
        "left": export_tree(model, left_child, depth + 1),
        "right": export_tree(model, right_child, depth + 1),
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
    features, labels = load_dataset()
    x_train, y_train, x_validation, y_validation, x_test, y_test = split_dataset(features, labels)

    model = DecisionTreeClassifier(
        criterion="gini",
        max_depth=MAX_DEPTH,
        min_samples_leaf=MIN_SAMPLES_LEAF,
        random_state=RANDOM_SEED,
    )
    model.fit(x_train, y_train)

    metrics = {
        "dataset": {
            "source": str(DATA_PATH),
            "kind": "synthetic",
            "total_rows": len(labels),
            "train_rows": len(y_train),
            "validation_rows": len(y_validation),
            "test_rows": len(y_test),
        },
        "model": {
            "model_name": "decision_tree_sklearn",
            "model_version": "sklearn-synthetic-poc-v1",
            "library": "scikit-learn",
            "max_depth": MAX_DEPTH,
            "min_samples_leaf": MIN_SAMPLES_LEAF,
            "decision_threshold": DECISION_THRESHOLD,
        },
        "train": evaluate(model, x_train, y_train),
        "validation": evaluate(model, x_validation, y_validation),
        "test": evaluate(model, x_test, y_test),
        "disclaimer": (
            "This scikit-learn model is trained locally on synthetic data for PoC/demo only. "
            "Production still reads the exported JSON artifact and does not need scikit-learn."
        ),
    }
    artifact = {
        "model_name": "decision_tree",
        "model_version": "sklearn-synthetic-poc-v1",
        "training_library": "scikit-learn",
        "feature_names": DECISION_TREE_FEATURE_NAMES,
        "decision_threshold": DECISION_THRESHOLD,
        "tree": export_tree(model),
        "metrics": metrics,
    }

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    MODEL_PATH.write_text(json.dumps(artifact, ensure_ascii=False, indent=2), encoding="utf-8")
    METRICS_PATH.write_text(json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8")
    RULES_PATH.write_text("\n".join(render_rules(artifact["tree"])) + "\n", encoding="utf-8")
    print(json.dumps(metrics, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

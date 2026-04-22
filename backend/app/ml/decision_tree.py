from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.ml.features import build_decision_tree_features, feature_vector


ARTIFACT_PATH = Path(__file__).resolve().parent / "artifacts" / "decision_tree_model.json"


@lru_cache(maxsize=1)
def load_decision_tree_artifact() -> dict[str, Any] | None:
    if not ARTIFACT_PATH.exists():
        return None
    return json.loads(ARTIFACT_PATH.read_text(encoding="utf-8"))


def predict_decision_tree_risk(session_row: dict, event_metrics: dict) -> dict[str, Any] | None:
    artifact = load_decision_tree_artifact()
    if artifact is None:
        return None

    feature_names = artifact["feature_names"]
    feature_values = build_decision_tree_features(session_row=session_row, event_metrics=event_metrics)
    vector = feature_vector(feature_values=feature_values, feature_names=feature_names)
    leaf = _walk_tree(artifact["tree"], vector, feature_names)
    risk_score = float(leaf["positive_rate"])
    threshold = float(artifact.get("decision_threshold", 0.5))

    return {
        "model_name": artifact.get("model_name", "decision_tree"),
        "model_version": artifact.get("model_version", "synthetic-poc-v1"),
        "risk_score": risk_score,
        "threshold": threshold,
        "prediction": int(risk_score >= threshold),
        "decision_path": leaf["path"],
        "feature_values": feature_values,
    }


def _walk_tree(node: dict[str, Any], vector: list[float], feature_names: list[str]) -> dict[str, Any]:
    path = []
    current = node
    while current["type"] != "leaf":
        feature_name = current["feature"]
        feature_index = feature_names.index(feature_name)
        threshold = float(current["threshold"])
        value = vector[feature_index]
        goes_left = value <= threshold
        path.append(
            {
                "feature": feature_name,
                "operator": "<=" if goes_left else ">",
                "threshold": threshold,
                "value": value,
            }
        )
        current = current["left"] if goes_left else current["right"]

    return {
        "positive_rate": current["positive_rate"],
        "prediction": current["prediction"],
        "path": path,
    }

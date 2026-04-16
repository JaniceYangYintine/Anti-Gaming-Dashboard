from typing import Literal

from pydantic import BaseModel


SeverityLevel = Literal["low", "medium", "high"]


class RuleItem(BaseModel):
    rule_id: str
    rule_code: str
    rule_name: str
    description: str
    parameter_json: dict
    severity_level: SeverityLevel
    is_active: bool

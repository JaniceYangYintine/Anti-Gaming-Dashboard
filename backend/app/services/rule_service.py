from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.rule import ComplianceRule
from app.schemas.rule import RuleItem


class RuleService:
    def list_rules(self, db: Session) -> list[RuleItem]:
        rules = db.execute(
            select(ComplianceRule).order_by(ComplianceRule.rule_code.asc())
        ).scalars().all()

        return [
            RuleItem(
                rule_id=str(rule.rule_id),
                rule_code=rule.rule_code,
                rule_name=rule.rule_name,
                description=rule.description,
                parameter_json=rule.parameter_json,
                severity_level=rule.severity_level,
                is_active=rule.is_active,
            )
            for rule in rules
        ]

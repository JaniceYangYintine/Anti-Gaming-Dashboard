from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas.rule import RuleItem
from app.services.rule_service import RuleService


router = APIRouter()
rule_service = RuleService()


@router.get("", response_model=list[RuleItem])
def list_rules(db: Session = Depends(get_db)) -> list[RuleItem]:
    return rule_service.list_rules(db=db)

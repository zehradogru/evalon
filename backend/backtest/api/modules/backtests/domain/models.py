from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List,  Union, Optional, Any

from stratejiler.strategy_catalog import PRESET_LIBRARY, RULE_LIBRARY


FAMILY_LABELS = [
    {"id": "all", "label": "All"},
    {"id": "price_action", "label": "Price Action"},
    {"id": "fibonacci", "label": "Fibonacci"},
    {"id": "pattern", "label": "Pattern"},
    {"id": "volume", "label": "Volume"},
    {"id": "indicator", "label": "Indicator"},
]

KNOWN_RULE_IDS = {rule.id for rule in RULE_LIBRARY}
STAGE_KEYS = ("trend", "setup", "trigger")


@dataclass
class BacktestRunRecord:
    run_id: str
    status: str
    created_at: int
    started_at: Optional[int] = None
    finished_at: Optional[int] = None
    progress: Dict[str, Any] = field(default_factory=dict)
    result: Dict[str, Any] | None = None
    events: List[Dict[str, Any]] = field(default_factory=list)
    error: Optional[str] = None


def build_rule_catalog() -> Dict[str, Any]:
    return {
        "count": len(RULE_LIBRARY),
        "families": FAMILY_LABELS,
        "rules": [
            {
                "id": rule.id,
                "label": rule.label,
                "family": rule.family,
                "category": rule.category,
                "stages": list(rule.stages),
                "summary": rule.summary,
            }
            for rule in RULE_LIBRARY
        ],
    }


def build_preset_catalog() -> Dict[str, Any]:
    return {
        "count": len(PRESET_LIBRARY),
        "presets": [
            {
                "id": preset.id,
                "label": preset.label,
                "summary": preset.summary,
                "direction": preset.direction,
                "stageThreshold": preset.stage_threshold,
                "ruleIds": list(preset.rule_ids),
            }
            for preset in PRESET_LIBRARY
        ],
    }


def validate_blueprint_payload(payload: Dict[str, Any]) -> None:
    symbol = str(payload.get("symbol") or "").strip()
    symbols_raw = payload.get("symbols") or []
    if not isinstance(symbols_raw, list):
        raise ValueError("symbols list olmali")

    cleaned_symbols = [str(item).strip() for item in symbols_raw if str(item).strip()]
    if not symbol and not cleaned_symbols:
        raise ValueError("symbol veya symbols zorunlu")

    stage_threshold = payload.get("stageThreshold")
    if not isinstance(stage_threshold, int) or stage_threshold < 1 or stage_threshold > 3:
        raise ValueError("stageThreshold 1 ile 3 arasinda olmali.")

    portfolio = payload.get("portfolio")
    if portfolio is not None:
        if not isinstance(portfolio, dict):
            raise ValueError("portfolio object olmali")
        for key in ("initialCapital", "positionSize", "commissionPct"):
            value = portfolio.get(key)
            if value is None:
                continue
            try:
                float(value)
            except (TypeError, ValueError) as exc:
                raise ValueError(f"portfolio.{key} sayi olmali") from exc

    stages = payload.get("stages")
    if not isinstance(stages, dict):
        raise ValueError("stages zorunlu")

    all_rules: List[Dict[str, Any]] = []
    for stage_key in STAGE_KEYS:
        stage = stages.get(stage_key)
        if not isinstance(stage, dict):
            raise ValueError(f"{stage_key} stage'i eksik")
        rules = stage.get("rules") or []
        if not isinstance(rules, list):
            raise ValueError(f"{stage_key}.rules list olmali")
        all_rules.extend(rules)

    if not all_rules:
        raise ValueError("En az bir kural secmelisin.")

    unknown = next(
        (
            str(rule.get("id") or "")
            for rule in all_rules
            if str(rule.get("id") or "") not in KNOWN_RULE_IDS
        ),
        None,
    )
    if unknown:
        raise ValueError(f"Bilinmeyen kural: {unknown}")

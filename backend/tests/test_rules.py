import pytest
from app.routers.rules import RuleCreateRequest, VALID_OPERATORS, VALID_SEVERITIES


def test_rule_operator_validation():
    for op in VALID_OPERATORS:
        req = RuleCreateRequest(
            device_id=1,
            metric="temperature",
            operator=op,
            threshold=50.0,
        )
        assert req.operator == op

    with pytest.raises(ValueError):
        RuleCreateRequest(
            device_id=1,
            metric="temperature",
            operator="!=",  # Unsupported operator
            threshold=50.0,
        )


def test_rule_severity_validation():
    for sev in VALID_SEVERITIES:
        req = RuleCreateRequest(
            device_id=1,
            metric="temperature",
            operator=">",
            threshold=80.0,
            severity=sev,
        )
        assert req.severity == sev

    with pytest.raises(ValueError):
        RuleCreateRequest(
            device_id=1,
            metric="temperature",
            operator=">",
            threshold=80.0,
            severity="extreme_danger",  # Invalid severity
        )


def test_rule_default_values():
    req = RuleCreateRequest(
        device_id=1,
        metric="pressure",
        operator="<=",
        threshold=10.0,
    )
    assert req.severity == "warning"
    assert req.debounce_seconds == 0
    assert req.enabled is True

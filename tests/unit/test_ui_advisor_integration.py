import inspect
import pytest
from decimal import Decimal
import ui.app as app

def test_api_post_advisor_timeout_configuration():
    src = inspect.getsource(app.api_post)
    assert 'req_timeout = 50 if "/advisor/" in endpoint else 8' in src

def test_api_post_autonomous_fallbacks():
    app.BACKEND_ONLINE = False
    r1 = app.api_post("/advisor/budget-scenarios", {})
    assert r1 is not None and "conservative" in r1

    r2 = app.api_post("/advisor/integral-audit", {"lines": []})
    assert r2 is not None and "price_effect" in r2

    r3 = app.api_post("/advisor/commercial-optimizer", {"channels": []})
    assert r3 is not None and "channel_analysis" in r3

    r4 = app.api_post("/advisor/supply-action-plan", {"items": []})
    assert r4 is not None and "suggested_purchase_orders" in r4

    r5 = app.api_post("/advisor/evaluate-initiative", {
        "initiative_name": "P",
        "initial_investment": "1000",
        "estimated_unit_cost": "10",
        "estimated_unit_price": "20",
        "expected_demand": 100,
        "fixed_costs": "100"
    })
    assert r5 is not None and "viability" in r5

    r6 = app.api_post("/advisor/generate-cross-report", {"audience": "Directorio / Gerencia General"})
    assert r6 is not None and "executive_summary" in r6

from scripts.audit_offline import audit

from pathlib import Path


def test_frontend_has_no_remote_runtime_urls():
    frontend = Path(__file__).resolve().parents[2] / "frontend"
    violations = audit(frontend)
    assert violations == []

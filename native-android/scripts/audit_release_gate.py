import json
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
MATRIX_PATH = ROOT / "native-android/PARITY-MATRIX.json"
EVIDENCE_DIR = ROOT / "native-android/release-evidence"

REQUIRED_GATES = {
    "backend.pythonDeploy": {
        "file": "python-deploy.json",
        "fields": ("service", "deployment"),
        "checks": {
            "health",
            "route-parity-67-of-67",
            "business-and-multipart",
            "persistent-volume-after-restart",
            "rollback",
        },
    },
    "physical.validation": {
        "file": "physical-validation.json",
        "fields": ("apkSha256", "device", "android"),
        "checks": {
            "cold-start",
            "member-flow",
            "moderator-flow",
            "offline-online-replay",
            "restart-persistence",
            "native-auditor",
        },
    },
}


def _non_empty_string(value):
    return isinstance(value, str) and bool(value.strip())


def validate_release_gate(matrix, evidence_dir):
    features = {item["id"]: item for item in matrix.get("features", [])}
    release_allowed = matrix.get("native", {}).get("releaseAllowed", False)
    assert isinstance(release_allowed, bool), "native.releaseAllowed precisa ser booleano"

    for feature_id in REQUIRED_GATES:
        assert feature_id in features, f"Gate obrigatório ausente da matriz: {feature_id}"
        assert features[feature_id].get("status") in {"pending", "implemented"}, (
            f"Status inválido para {feature_id}: {features[feature_id].get('status')}"
        )

    if not release_allowed:
        return "blocked"

    for feature_id, contract in REQUIRED_GATES.items():
        assert features[feature_id].get("status") == "implemented", (
            f"Release proibida: {feature_id} ainda não está implemented."
        )

        evidence_path = evidence_dir / contract["file"]
        assert evidence_path.is_file(), f"Release proibida: evidência ausente: {evidence_path}"
        evidence = json.loads(evidence_path.read_text(encoding="utf-8"))

        assert evidence.get("gate") == feature_id, f"Evidência não corresponde ao gate {feature_id}"
        assert evidence.get("result") == "passed", f"Evidência de {feature_id} não está aprovada"
        assert _non_empty_string(evidence.get("checkedAt")), f"Evidência de {feature_id} sem checkedAt"
        assert _non_empty_string(evidence.get("commit")) and len(evidence["commit"].strip()) >= 7, (
            f"Evidência de {feature_id} sem commit válido"
        )

        for field in contract["fields"]:
            assert _non_empty_string(evidence.get(field)), f"Evidência de {feature_id} sem {field}"

        if feature_id == "physical.validation":
            apk_sha256 = evidence["apkSha256"].strip().lower()
            assert len(apk_sha256) == 64 and all(char in "0123456789abcdef" for char in apk_sha256), (
                "Evidência física sem SHA-256 válido do APK"
            )

        checks = evidence.get("checks")
        assert isinstance(checks, list) and checks, f"Evidência de {feature_id} sem checks"
        assert all(isinstance(check, dict) and check.get("passed") is True for check in checks), (
            f"Evidência de {feature_id} contém check não aprovado"
        )
        passed_names = {
            check.get("name") for check in checks
            if isinstance(check, dict) and _non_empty_string(check.get("name")) and check.get("passed") is True
        }
        missing_checks = contract["checks"] - passed_names
        assert not missing_checks, (
            f"Evidência de {feature_id} não cobre checks obrigatórios: {sorted(missing_checks)}"
        )

    return "released"


def _expect_failure(matrix, evidence_dir):
    try:
        validate_release_gate(matrix, evidence_dir)
    except (AssertionError, json.JSONDecodeError):
        return
    raise AssertionError("Contrato deveria falhar fechado, mas aceitou evidência inválida")


def self_test():
    base_features = [
        {"id": "backend.pythonDeploy", "status": "pending"},
        {"id": "physical.validation", "status": "pending"},
    ]
    blocked = {"native": {"releaseAllowed": False}, "features": base_features}

    with tempfile.TemporaryDirectory() as tmp:
        evidence_dir = Path(tmp)
        assert validate_release_gate(blocked, evidence_dir) == "blocked"

        released = {
            "native": {"releaseAllowed": True},
            "features": [
                {"id": "backend.pythonDeploy", "status": "implemented"},
                {"id": "physical.validation", "status": "implemented"},
            ],
        }
        _expect_failure(released, evidence_dir)

        backend = {
            "gate": "backend.pythonDeploy",
            "result": "passed",
            "checkedAt": "2026-09-01T00:00:00Z",
            "commit": "1234567",
            "service": "python-homolog",
            "deployment": "deploy-1",
            "checks": [{"name": name, "passed": True} for name in REQUIRED_GATES["backend.pythonDeploy"]["checks"]],
        }
        physical = {
            "gate": "physical.validation",
            "result": "passed",
            "checkedAt": "2026-09-01T00:00:00Z",
            "commit": "1234567",
            "apkSha256": "a" * 64,
            "device": "physical-device",
            "android": "10",
            "checks": [{"name": name, "passed": True} for name in REQUIRED_GATES["physical.validation"]["checks"]],
        }
        (evidence_dir / "python-deploy.json").write_text(json.dumps(backend), encoding="utf-8")
        (evidence_dir / "physical-validation.json").write_text(json.dumps(physical), encoding="utf-8")
        assert validate_release_gate(released, evidence_dir) == "released"

        physical.pop("device")
        (evidence_dir / "physical-validation.json").write_text(json.dumps(physical), encoding="utf-8")
        _expect_failure(released, evidence_dir)


def main():
    self_test()
    matrix = json.loads(MATRIX_PATH.read_text(encoding="utf-8"))
    state = validate_release_gate(matrix, EVIDENCE_DIR)
    if state == "blocked":
        print("OK: release final permanece bloqueada; gates pendentes podem continuar em homologação.")
    else:
        print("OK: todos os gates finais possuem status e evidência aprovados; releaseAllowed pode permanecer true.")


if __name__ == "__main__":
    main()

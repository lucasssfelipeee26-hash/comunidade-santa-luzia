import json
from pathlib import Path

root = Path(__file__).resolve().parents[2]
matrix_path = root / "native-android/PARITY-MATRIX.json"
evidence_dir = root / "native-android/release-evidence"

matrix = json.loads(matrix_path.read_text(encoding="utf-8"))
features = {item["id"]: item for item in matrix.get("features", [])}
release_allowed = bool(matrix.get("native", {}).get("releaseAllowed", False))

required_gates = {
    "backend.pythonDeploy": evidence_dir / "python-deploy.json",
    "physical.validation": evidence_dir / "physical-validation.json",
}

for feature_id in required_gates:
    assert feature_id in features, f"Gate obrigatório ausente da matriz: {feature_id}"
    assert features[feature_id].get("status") in {"pending", "implemented"}, (
        f"Status inválido para {feature_id}: {features[feature_id].get('status')}"
    )

if not release_allowed:
    print("OK: release final permanece bloqueada; gates pendentes podem continuar em homologação.")
    raise SystemExit(0)

for feature_id, evidence_path in required_gates.items():
    assert features[feature_id].get("status") == "implemented", (
        f"Release proibida: {feature_id} ainda não está implemented."
    )
    assert evidence_path.is_file(), f"Release proibida: evidência ausente: {evidence_path.relative_to(root)}"

    evidence = json.loads(evidence_path.read_text(encoding="utf-8"))
    assert evidence.get("gate") == feature_id, f"Evidência não corresponde ao gate {feature_id}"
    assert evidence.get("result") == "passed", f"Evidência de {feature_id} não está aprovada"
    assert isinstance(evidence.get("checkedAt"), str) and evidence["checkedAt"].strip(), (
        f"Evidência de {feature_id} sem checkedAt"
    )
    assert isinstance(evidence.get("commit"), str) and len(evidence["commit"].strip()) >= 7, (
        f"Evidência de {feature_id} sem commit válido"
    )

    checks = evidence.get("checks")
    assert isinstance(checks, list) and checks, f"Evidência de {feature_id} sem checks"
    assert all(isinstance(check, dict) and check.get("passed") is True for check in checks), (
        f"Evidência de {feature_id} contém check não aprovado"
    )

print("OK: todos os gates finais possuem status e evidência aprovados; releaseAllowed pode permanecer true.")

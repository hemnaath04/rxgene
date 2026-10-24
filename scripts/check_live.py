"""Smoke-test a deployed RxGene: CDS Hooks discovery, order-select cards, summary, exposure.

Usage: python3 scripts/check_live.py [base_url]   (default https://rxgene.vercel.app)
For a protected preview, first open its Vercel share link with curl -c <jar>, then set
RXGENE_COOKIE_JAR=<jar>. Exits non-zero if any check fails. Synthetic data only.
"""
import json
import os
import subprocess
import sys

BASE = (sys.argv[1] if len(sys.argv) > 1 else "https://rxgene.vercel.app").rstrip("/")


def curl(method, path, body=None):
    # curl instead of urllib: python.org builds on macOS often lack root certs.
    cmd = ["curl", "-s", "-i", "-X", method, BASE + path, "-H", "Content-Type: application/json"]
    if os.environ.get("RXGENE_COOKIE_JAR"):  # protected previews: cookie from a Vercel share link
        cmd += ["-b", os.environ["RXGENE_COOKIE_JAR"]]
    if body is not None:
        cmd += ["--data", json.dumps(body)]
    raw = subprocess.run(cmd, capture_output=True, text=True, timeout=30).stdout
    head, _, text = raw.replace("\r\n", "\n").partition("\n\n")
    status = int(head.split()[1]) if head.startswith("HTTP") else 0
    headers = {k.strip().lower(): v.strip() for k, _, v in (l.partition(":") for l in head.split("\n")[1:])}
    return status, headers, text


def genotype_observation(diplotype):
    return {"resourceType": "Observation", "status": "final",
            "code": {"coding": [{"system": "http://loinc.org", "code": "84413-4"}]},
            "valueCodeableConcept": {"text": f"CYP2D6{diplotype}"},
            "component": [{"code": {"coding": [{"system": "http://loinc.org", "code": "48018-6"}]},
                           "valueCodeableConcept": {"coding": [{"system": "http://www.genenames.org/geneId", "code": "HGNC:2625"}]}}]}


def order_select(meds, added, diplotype=None):
    entries = [{"resource": {"resourceType": "MedicationRequest", "id": m, "status": "active" if m != added else "draft",
                             "intent": "order", "medicationCodeableConcept": {"text": m}}} for m in meds + [added]]
    req = {"hook": "order-select", "hookInstance": "00000000-0000-4000-8000-000000000001",
           "context": {"userId": "Practitioner/demo", "patientId": "check", "selections": [f"MedicationRequest/{added}"],
                       "draftOrders": {"resourceType": "Bundle", "entry": entries}}}
    if diplotype:
        req["prefetch"] = {"pgx": {"resourceType": "Bundle", "entry": [{"resource": genotype_observation(diplotype)}]}}
    return req


results = []


def check(name, ok, detail=""):
    results.append(ok)
    print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"  ({detail})" if detail else ""))


status, headers, text = curl("GET", "/cds-services")
services = json.loads(text).get("services", []) if status == 200 else []
check("discovery returns one order-select service", status == 200 and len(services) == 1 and services[0].get("hook") == "order-select", f"HTTP {status}")
check("CORS header on discovery", headers.get("access-control-allow-origin") == "*")

cases = [
    ("P01 *1/*1 + fluoxetine, add codeine -> critical", [ "fluoxetine"], "codeine", "*1/*1", "critical", None),
    ("P02 *4/*4 + fluoxetine, add codeine -> critical + no-further-effect note", ["fluoxetine"], "codeine", "*4/*4", "critical", "no further effect"),
    ("P03 *1/*1, add codeine -> info (no supported alert)", [], "codeine", "*1/*1", "info", None),
    ("No genotype Observation -> info (insufficient data)", [], "codeine", None, "info", "insufficient"),
]
for name, meds, added, dip, indicator, phrase in cases:
    status, _, text = curl("POST", "/cds-services/rxgene-order-select", order_select(meds, added, dip))
    try:
        cards = json.loads(text).get("cards", [])
    except json.JSONDecodeError:
        cards = []
    card = next((c for c in cards if added in (c.get("summary", "") + c.get("detail", "")).lower()), cards[0] if cards else {})
    blob = json.dumps(card).lower()
    ok = status == 200 and card.get("indicator") == indicator and len(card.get("summary", "")) < 140 and (phrase is None or phrase in blob)
    ok = ok and "safe" not in blob.replace("not the same as safe", "")
    check(name, ok, f"HTTP {status}, indicator={card.get('indicator')}")

# The public CDS Hooks sandbox sends DSTU2 MedicationOrder, not R4 MedicationRequest.
dstu2 = order_select([], "codeine")
for e in dstu2["context"]["draftOrders"]["entry"]:
    e["resource"]["resourceType"] = "MedicationOrder"
    e["resource"]["medicationCodeableConcept"]["text"] = "Codeine sulfate 30 MG Oral Tablet"
dstu2["context"]["selections"] = ["MedicationOrder/codeine"]
status, _, text = curl("POST", "/cds-services/rxgene-order-select", dstu2)
try:
    cards = json.loads(text).get("cards", [])
except json.JSONDecodeError:
    cards = []
check("DSTU2 MedicationOrder (sandbox shape) -> 1 info card", status == 200 and len(cards) == 1 and cards[0].get("indicator") == "info", f"HTTP {status}, cards={len(cards)}")

status, _, text = curl("GET", "/api/summary.test")
check("test files are not deployed as endpoints", status == 404, f"HTTP {status}")

print(f"\n{sum(results)}/{len(results)} checks passed against {BASE}")
sys.exit(0 if all(results) else 1)

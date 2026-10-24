"""Snapshot openFDA adverse-event report counts for RxGene's demo drug pairs into data/openfda/.

These are real-world reports for context only. A report is not proof that a medicine
caused the harm, and the rule engine never reads this file.

Usage: python3 scripts/fetch_openfda.py
"""
import json
import pathlib
import subprocess
import time
import urllib.parse
from datetime import date

API = "https://api.fda.gov/drug/event.json"
OUT = pathlib.Path(__file__).resolve().parent.parent / "data" / "openfda" / "pair_reports.json"

# (drug the alert is about, co-medication) pairs that appear in the preset patients and fixtures.
PAIRS = [
    ("codeine", "fluoxetine"), ("codeine", "paroxetine"), ("codeine", "bupropion"),
    ("codeine", "duloxetine"), ("codeine", "sertraline"),
    ("tramadol", "fluoxetine"), ("tramadol", "bupropion"),
    ("atomoxetine", "fluoxetine"), ("atomoxetine", "duloxetine"),
    ("clopidogrel", "omeprazole"),
]
# MedDRA preferred terms that match the harm RxGene warns about.
REACTIONS = ["DRUG INTERACTION", "DRUG INEFFECTIVE"]
CAVEAT = ("Reports submitted to FDA (FAERS) that list both medicines. A report is not proof "
          "that either medicine caused the reaction, and FAERS is not a complete safety record.")


def get(params):
    # curl instead of urllib: python.org builds on macOS often lack root certs.
    url = f"{API}?{params}"
    out = subprocess.run(["curl", "-s", url], capture_output=True, text=True, timeout=30).stdout
    time.sleep(0.4)  # stay well under openFDA's unauthenticated rate limit
    return url, json.loads(out)


def both(a, b):
    term = lambda d: f'patient.drug.openfda.generic_name:"{d.upper()}"'
    return urllib.parse.quote(f"{term(a)} AND {term(b)}", safe=':"').replace("%20", "+")


rows = []
for drug, comed in PAIRS:
    search = both(drug, comed)
    url, data = get(f"search={search}&limit=1")
    total = data.get("meta", {}).get("results", {}).get("total", 0)
    reactions = {}
    for r in REACTIONS:
        _, d = get(f"search={search}+AND+patient.reaction.reactionmeddrapt.exact:%22{r.replace(' ', '+')}%22&limit=1")
        reactions[r] = d.get("meta", {}).get("results", {}).get("total", 0)
    rows.append({"drug": drug, "coMedication": comed, "totalReports": total,
                 "reactionReports": reactions, "query": url})
    print(f"{drug:12} + {comed:11} total={total:>5}  " + "  ".join(f"{k}={v}" for k, v in reactions.items()))

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps({
    "source": "openFDA drug adverse event API (FAERS), https://open.fda.gov/apis/drug/event/",
    "fetched": date.today().isoformat(),
    "caveat": CAVEAT,
    "pairs": rows,
}, indent=1) + "\n")
print(f"wrote {OUT.relative_to(OUT.parents[2])}")

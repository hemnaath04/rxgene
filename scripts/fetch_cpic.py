"""Snapshot the CPIC data RxGene needs into data/cpic/ so the demo never calls the API live.

Usage: python3 scripts/fetch_cpic.py
"""
import json
import pathlib
import subprocess
from datetime import date

API = "https://api.cpicpgx.org/v1"
OUT = pathlib.Path(__file__).resolve().parent.parent / "data" / "cpic"
DRUGS = ["codeine", "tramadol", "atomoxetine", "clopidogrel"]


def get(query):
    # curl instead of urllib: python.org builds on macOS often lack root certs.
    result = subprocess.run(["curl", "-sf", API + query], capture_output=True, text=True, check=True)
    return json.loads(result.stdout)


def save(name, rows, query):
    payload = {"source": API + query, "fetched": date.today().isoformat(), "rows": rows}
    (OUT / name).write_text(json.dumps(payload, indent=1, ensure_ascii=False) + "\n")
    print(f"{name}: {len(rows)} rows")


for gene in ["CYP2D6", "CYP2C19"]:
    q = f"/allele?genesymbol=eq.{gene}&select=name,activityvalue,clinicalfunctionalstatus&order=name"
    save(f"{gene.lower()}_alleles.json", get(q), q)

for drug in DRUGS:
    q = (f"/recommendation_view?drugname=eq.{drug}"
         "&select=drugname,population,phenotypes,activityscore,lookupkey,drugrecommendation,classification,implications")
    save(f"recommendations/{drug}.json", get(q), q)

q = "/guideline?select=name,url&order=name"
save("guidelines.json", get(q), q)

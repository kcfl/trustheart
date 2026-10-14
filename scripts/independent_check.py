"""Independent check of TrustHeart API outputs. No project helpers are trusted:
numbers come from the files / live app, constants from the frozen final_selection.md."""
import json, sys
from pathlib import Path
from scipy.special import expit, logit

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

BASE_RATE = {"CAD": 216 / 303, "LAD": 177 / 303, "LCX": 119 / 303, "RCA": 114 / 303}
PLATT = {  # (a, b) from models/final_selection.md, 4 decimals
    "quick": {"CAD": (13.7899, 0.9356), "LAD": (11.4114, 0.2925), "LCX": (1.3056, -0.4250), "RCA": (11.9557, -0.5293)},
    "full":  {"CAD": (12.3628, 0.9704), "LAD": (8.9140, 0.3702),  "LCX": (1.3056, -0.4250), "RCA": (11.9557, -0.5293)},
}
fails = 0

def check(label, d):
    global fails
    mode, preds = d["mode"], d["predictions"]
    for t, p in preds.items():
        r_id = abs(p["base"] + sum(c["contribution"] for c in p["contributions"]) + p["other_total"] - p["logit_model"])
        r_ex = abs(float(expit(p["logit_model"])) - p["calibrated_probability"])
        r_br = abs(p["base_rate"] - BASE_RATE[t])
        a, b = PLATT[mode][t]
        r_raw = abs(float(expit(a * float(logit(p["raw_probability"])) + b)) - p["calibrated_probability"])
        ok = r_id < 1e-9 and r_ex < 1e-9 and r_br < 1e-9 and r_raw < 2e-3
        fails += (not ok)
        print(f"{label:34s} {t}: identity={r_id:.1e} expit={r_ex:.1e} base_rate={r_br:.1e} raw->cal={r_raw:.1e} {'OK' if ok else 'FAIL'}")
    v = [preds[t]["calibrated_probability"] for t in ("LAD", "LCX", "RCA")]
    up = min(1.0, sum(v)); r_up = abs(up - d["consistency"]["upper"])
    ok = r_up < 1e-9; fails += (not ok)
    print(f"{label:34s} consistency.upper vs sum of vessels: {r_up:.1e} {'OK' if ok else 'FAIL'}")

if len(sys.argv) > 1:                       # stored files
    for path in sys.argv[1:]:
        check(Path(path).name, json.load(open(path, encoding="utf-8")))
else:                                       # live app, in-process
    from fastapi.testclient import TestClient
    from backend.app.main import app
    c = TestClient(app)
    samples = c.get("/api/samples").json()["samples"]
    for mode in ("quick", "full"):
        for s in samples:
            r = c.post("/api/predict", json={"mode": mode, "inputs": s["inputs"]})
            assert r.status_code == 200, r.text
            check(f"live {mode}/{s['label']}", r.json())

print("ALL OK" if not fails else f"FAILED: {fails}")
sys.exit(1 if fails else 0)
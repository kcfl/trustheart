"""Test running backend under isolated virtual environment with real response fields."""

import json
import subprocess
import sys
import time
import urllib.request
import urllib.error

PORT = 8004
BASE_URL = f"http://127.0.0.1:{PORT}"

def print_prediction_results(mode: str, resp_data: dict, status_code: int):
    print(f"\n--- POST /api/predict (mode: {mode}) ---")
    print(f"Status: {status_code}")
    print(f"Mode: {resp_data.get('mode')}")

    preds = resp_data.get("predictions", {})
    for vessel in ["CAD", "LAD", "LCX", "RCA"]:
        p = preds.get(vessel, {})
        disp_p = p.get("display_probability")
        model_p = p.get("calibrated_probability")
        adj = p.get("adjusted")
        band = p.get("band")
        disp_band = p.get("display_band")
        print(f"  {vessel}: display_p={disp_p:.4f}, model_p={model_p:.4f}, adjusted={adj}, band={band}, display_band={disp_band}")

    cons = resp_data.get("consistency", {})
    print(f"  Consistency Status: {cons.get('status')}")
    print(f"    p_cad_model    : {cons.get('p_cad_model'):.4f}")
    print(f"    p_cad_adjusted : {cons.get('p_cad_adjusted'):.4f}")
    print(f"    lower bound    : {cons.get('lower'):.4f}")
    print(f"    upper bound    : {cons.get('upper'):.4f}")
    print(f"  Similar Patients Count: {len(resp_data.get('trust', {}).get('similar_patients', []))}")

def main():
    print(f"Starting uvicorn on port {PORT} using python: {sys.executable}")
    proc = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "backend.app.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            str(PORT),
            "--log-level",
            "info",
        ],
        cwd=".",
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )

    try:
        # Wait up to 15s for server to become healthy
        healthy = False
        health_resp = None
        for i in range(30):
            time.sleep(0.5)
            try:
                with urllib.request.urlopen(f"{BASE_URL}/api/health", timeout=2) as resp:
                    if resp.status == 200:
                        health_resp = json.loads(resp.read().decode("utf-8"))
                        healthy = True
                        break
            except Exception:
                pass

        if not healthy:
            print("Server failed to become healthy. Process output:")
            proc.kill()
            out, _ = proc.communicate(timeout=5)
            print(out)
            sys.exit(1)

        print("--- GET /api/health Response ---")
        print(json.dumps(health_resp, indent=2))

        # Fetch sample patient from /api/samples
        with urllib.request.urlopen(f"{BASE_URL}/api/samples", timeout=5) as resp:
            samples_data = json.loads(resp.read().decode("utf-8"))
            sample_0 = samples_data["samples"][0]
            sample_0_inputs = sample_0["inputs"]
            print(f"\nFetched sample 0 (label: {sample_0.get('label')}, case_id: {sample_0.get('case_id')})")

        # POST /api/predict in quick mode
        req_quick = urllib.request.Request(
            f"{BASE_URL}/api/predict",
            data=json.dumps({"mode": "quick", "inputs": sample_0_inputs}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req_quick, timeout=5) as resp:
            quick_resp = json.loads(resp.read().decode("utf-8"))
            print_prediction_results("quick", quick_resp, resp.status)

        # POST /api/predict in full mode
        req_full = urllib.request.Request(
            f"{BASE_URL}/api/predict",
            data=json.dumps({"mode": "full", "inputs": sample_0_inputs}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req_full, timeout=5) as resp:
            full_resp = json.loads(resp.read().decode("utf-8"))
            print_prediction_results("full", full_resp, resp.status)

        print("\nAll runtime-test calls PASSED successfully.")

    finally:
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()

if __name__ == "__main__":
    main()

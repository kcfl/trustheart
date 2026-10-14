"""Test running backend under runtime-only virtual environment."""

import json
import subprocess
import sys
import time
import urllib.request
import urllib.error

PORT = 8004
BASE_URL = f"http://127.0.0.1:{PORT}"

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
            print("\n--- POST /api/predict (mode: quick) ---")
            print(f"Status: {resp.status}")
            print(f"Mode: {quick_resp.get('mode')}")
            print(f"CAD probability: {quick_resp.get('predictions', {}).get('CAD', {}).get('calibrated_probability')}")
            print(f"LAD probability: {quick_resp.get('predictions', {}).get('LAD', {}).get('calibrated_probability')}")
            print(f"LCX probability: {quick_resp.get('predictions', {}).get('LCX', {}).get('calibrated_probability')}")
            print(f"RCA probability: {quick_resp.get('predictions', {}).get('RCA', {}).get('calibrated_probability')}")
            print(f"Coherence clipped: {quick_resp.get('trust', {}).get('coherence', {}).get('cad_clipped')}")
            print(f"Similar count: {len(quick_resp.get('trust', {}).get('similar_patients', []))}")

        # POST /api/predict in full mode
        req_full = urllib.request.Request(
            f"{BASE_URL}/api/predict",
            data=json.dumps({"mode": "full", "inputs": sample_0_inputs}).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req_full, timeout=5) as resp:
            full_resp = json.loads(resp.read().decode("utf-8"))
            print("\n--- POST /api/predict (mode: full) ---")
            print(f"Status: {resp.status}")
            print(f"Mode: {full_resp.get('mode')}")
            print(f"CAD probability: {full_resp.get('predictions', {}).get('CAD', {}).get('calibrated_probability')}")
            print(f"LAD probability: {full_resp.get('predictions', {}).get('LAD', {}).get('calibrated_probability')}")
            print(f"LCX probability: {full_resp.get('predictions', {}).get('LCX', {}).get('calibrated_probability')}")
            print(f"RCA probability: {full_resp.get('predictions', {}).get('RCA', {}).get('calibrated_probability')}")
            print(f"Coherence clipped: {full_resp.get('trust', {}).get('coherence', {}).get('cad_clipped')}")
            print(f"Similar count: {len(full_resp.get('trust', {}).get('similar_patients', []))}")

        print("\nAll runtime-test calls PASSED successfully.")

    finally:
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()


if __name__ == "__main__":
    main()

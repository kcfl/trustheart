"""Simulate Docker container execution by creating an isolated directory with only COPY'd files."""

import json
import os
import shutil
import subprocess
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SIM_DIR = REPO_ROOT / ".docker-sim"
PORT = 8005
BASE_URL = f"http://127.0.0.1:{PORT}"

def copy_tree_filtered(src: Path, dst: Path):
    """Copy directory excluding __pycache__ and bytecode."""
    dst.mkdir(parents=True, exist_ok=True)
    for root, dirs, files in os.walk(src):
        # Exclude __pycache__
        dirs[:] = [d for d in dirs if d != "__pycache__" and not d.startswith(".")]
        rel_root = Path(root).relative_to(src)
        target_root = dst / rel_root
        target_root.mkdir(parents=True, exist_ok=True)
        for f in files:
            if not f.endswith((".pyc", ".pyo", ".pyd")):
                shutil.copy2(Path(root) / f, target_root / f)

def main():
    print("=" * 75)
    print("DOCKER CONTEXT SIMULATION")
    print("Notice: Docker is not installed. This script simulates the Docker build context")
    print("by creating an isolated directory containing ONLY files COPY'd by the Dockerfile.")
    print("=" * 75)

    if SIM_DIR.exists():
        shutil.rmtree(SIM_DIR, ignore_errors=True)
    SIM_DIR.mkdir(parents=True, exist_ok=True)

    try:
        # 1. Copy files that Dockerfile COPY lines specify
        print("[1/6] Copying Dockerfile context into .docker-sim/ ...")
        shutil.copy2(REPO_ROOT / "requirements-runtime.txt", SIM_DIR / "requirements-runtime.txt")
        copy_tree_filtered(REPO_ROOT / "backend", SIM_DIR / "backend")
        copy_tree_filtered(REPO_ROOT / "ml", SIM_DIR / "ml")
        copy_tree_filtered(REPO_ROOT / "models", SIM_DIR / "models")
        copy_tree_filtered(REPO_ROOT / "data", SIM_DIR / "data")
        copy_tree_filtered(REPO_ROOT / "frontend" / "dist", SIM_DIR / "frontend" / "dist")

        # 2. Create fresh venv in .docker-sim
        print("[2/6] Creating isolated virtual environment in .docker-sim/.venv ...")
        subprocess.check_call([sys.executable, "-m", "venv", str(SIM_DIR / ".venv")])
        venv_python = SIM_DIR / ".venv" / "Scripts" / "python.exe"

        # 3. Install requirements-runtime.txt
        print("[3/6] Installing requirements-runtime.txt into isolated environment ...")
        subprocess.check_call([
            str(venv_python), "-m", "pip", "install", "--no-cache-dir", "-r", str(SIM_DIR / "requirements-runtime.txt")
        ], stdout=subprocess.DEVNULL)

        # 4. Start uvicorn from .docker-sim
        print(f"[4/6] Launching uvicorn on port {PORT} from working directory {SIM_DIR} ...")
        proc = subprocess.Popen(
            [
                str(venv_python),
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
            cwd=str(SIM_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )

        try:
            # Wait for server to become healthy
            healthy = False
            for _ in range(30):
                time.sleep(0.5)
                try:
                    with urllib.request.urlopen(f"{BASE_URL}/api/health", timeout=2) as resp:
                        if resp.status == 200:
                            healthy = True
                            break
                except Exception:
                    pass

            if not healthy:
                print("Server failed to respond on /api/health. Process output:")
                proc.kill()
                out, _ = proc.communicate(timeout=5)
                print(out)
                sys.exit(1)

            print("[5/6] Executing test requests against simulated Docker environment:")

            # GET /
            with urllib.request.urlopen(f"{BASE_URL}/", timeout=5) as resp:
                print(f"\n--- GET / (Frontend SPA index.html) ---")
                print(f"Status: {resp.status}")
                print(f"Content-Type: {resp.headers.get('Content-Type')}")
                print(f"CSP: {resp.headers.get('Content-Security-Policy')}")
                html_snippet = resp.read().decode("utf-8")[:100]
                print(f"Body snippet: {html_snippet.strip()}...")

            # GET /api/health
            with urllib.request.urlopen(f"{BASE_URL}/api/health", timeout=5) as resp:
                print(f"\n--- GET /api/health ---")
                print(f"Status: {resp.status}")
                print(f"CSP: {resp.headers.get('Content-Security-Policy')}")
                health_data = json.loads(resp.read().decode("utf-8"))
                print(f"Response: {json.dumps(health_data, indent=2)}")

            # Fetch sample patient from /api/samples
            with urllib.request.urlopen(f"{BASE_URL}/api/samples", timeout=5) as resp:
                samples_data = json.loads(resp.read().decode("utf-8"))
                sample_0 = samples_data["samples"][0]
                sample_0_inputs = sample_0["inputs"]
                print(f"\nFetched sample patient {sample_0.get('label')} (case_id {sample_0.get('case_id')})")

            # POST /api/predict in quick mode
            req_quick = urllib.request.Request(
                f"{BASE_URL}/api/predict",
                data=json.dumps({"mode": "quick", "inputs": sample_0_inputs}).encode("utf-8"),
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req_quick, timeout=5) as resp:
                q_data = json.loads(resp.read().decode("utf-8"))
                print(f"\n--- POST /api/predict (mode: quick) ---")
                print(f"Status: {resp.status}")
                print(f"Mode: {q_data.get('mode')}")
                for vessel in ["CAD", "LAD", "LCX", "RCA"]:
                    v_pred = q_data.get("predictions", {}).get(vessel, {})
                    print(f"  {vessel}: display_p={v_pred.get('display_probability'):.4f}, model_p={v_pred.get('calibrated_probability'):.4f}, band={v_pred.get('band')}")
                print(f"  Consistency status: {q_data.get('consistency', {}).get('status')}")

            # POST /api/predict in full mode
            req_full = urllib.request.Request(
                f"{BASE_URL}/api/predict",
                data=json.dumps({"mode": "full", "inputs": sample_0_inputs}).encode("utf-8"),
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req_full, timeout=5) as resp:
                f_data = json.loads(resp.read().decode("utf-8"))
                print(f"\n--- POST /api/predict (mode: full) ---")
                print(f"Status: {resp.status}")
                print(f"Mode: {f_data.get('mode')}")
                for vessel in ["CAD", "LAD", "LCX", "RCA"]:
                    v_pred = f_data.get("predictions", {}).get(vessel, {})
                    print(f"  {vessel}: display_p={v_pred.get('display_probability'):.4f}, model_p={v_pred.get('calibrated_probability'):.4f}, band={v_pred.get('band')}")
                print(f"  Consistency status: {f_data.get('consistency', {}).get('status')}")

            print("\n[6/6] Shutting down simulated server...")

        finally:
            proc.terminate()
            try:
                proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                proc.kill()

    finally:
        print("Cleaning up .docker-sim directory ...")
        shutil.rmtree(SIM_DIR, ignore_errors=True)
        print("Done. Cleaned up .docker-sim.")

if __name__ == "__main__":
    main()

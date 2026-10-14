"""Launch local uvicorn on port 8007 and execute scripts/smoke_deployed.py."""

import os
import subprocess
import sys
import time
import urllib.request

PORT = 8007
BASE_URL = f"http://127.0.0.1:{PORT}"

def main():
    env = os.environ.copy()
    env["TRUSTHEART_TRUST_PROXY"] = "true"
    env["TRUSTHEART_TRUSTED_PROXY_HOPS"] = "1"
    env["TRUSTHEART_RATE_LIMIT"] = "60"

    print(f"Starting uvicorn on port {PORT} with TRUSTHEART_TRUST_PROXY=true, TRUSTHEART_RATE_LIMIT=60...")
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
            "warning",
        ],
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )

    try:
        # Wait up to 10s for server ready
        healthy = False
        for _ in range(40):
            time.sleep(0.25)
            try:
                with urllib.request.urlopen(f"{BASE_URL}/api/health", timeout=1) as resp:
                    if resp.status == 200:
                        healthy = True
                        break
            except Exception:
                pass

        if not healthy:
            print("Server failed to become healthy on port 8007.")
            proc.kill()
            sys.exit(1)

        print("Server is healthy. Running scripts/smoke_deployed.py against local instance...\n")
        res = subprocess.run(
            [sys.executable, "scripts/smoke_deployed.py", BASE_URL],
            text=True,
            capture_output=True,
        )
        print(res.stdout)
        if res.stderr:
            print("STDERR:", res.stderr)
        if res.returncode != 0:
            print(f"smoke_deployed.py exited with error code {res.returncode}")
            sys.exit(res.returncode)

    finally:
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()
        print("Stopped local uvicorn on port 8007.")

if __name__ == "__main__":
    main()

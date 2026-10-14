"""Measure server startup time from process launch to first 200 on /api/health."""

import subprocess
import sys
import time
import urllib.request
import urllib.error

PORT = 8006
HEALTH_URL = f"http://127.0.0.1:{PORT}/api/health"

def main():
    print(f"Launching uvicorn on port {PORT} with python: {sys.executable} ...")
    t0 = time.perf_counter()

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
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )

    startup_time = None
    try:
        # Poll health endpoint
        for _ in range(100):
            try:
                with urllib.request.urlopen(HEALTH_URL, timeout=1.0) as resp:
                    if resp.status == 200:
                        startup_time = time.perf_counter() - t0
                        break
            except Exception:
                time.sleep(0.05)

        if startup_time is not None:
            print(f"Server reached 200 OK on /api/health in: {startup_time:.3f} s ({startup_time * 1000:.1f} ms)")
        else:
            print("Failed to reach healthy state within 5 seconds.")
            out, err = proc.communicate(timeout=2)
            print("Stdout:", out)
            print("Stderr:", err)
            sys.exit(1)

    finally:
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()
        print("Server stopped.")

if __name__ == "__main__":
    main()

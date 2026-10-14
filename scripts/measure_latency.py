"""Benchmark in-process sequential POST /api/predict latency using TestClient."""

import os
import sys
import time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import numpy as np
from fastapi.testclient import TestClient

# Disable rate limiting for benchmark
os.environ["TRUSTHEART_RATE_LIMIT"] = "10000"

from backend.app.main import app
from backend.app.security import reset_rate_limiter

def benchmark() -> None:
    reset_rate_limiter()
    client = TestClient(app)

    # Fetch a sample patient
    samples_res = client.get("/api/samples")
    sample_inputs = samples_res.json()["samples"][1]["inputs"]

    req_body = {
        "mode": "quick",
        "inputs": sample_inputs,
        "case_id": 125,
    }

    # Warmup
    for _ in range(5):
        w = client.post("/api/predict", json=req_body)
        assert w.status_code == 200

    latencies_ms = []
    n_calls = 200

    for _ in range(n_calls):
        t0 = time.perf_counter()
        res = client.post("/api/predict", json=req_body)
        t1 = time.perf_counter()
        assert res.status_code == 200
        latencies_ms.append((t1 - t0) * 1000.0)

    median_lat = float(np.median(latencies_ms))
    p95_lat = float(np.percentile(latencies_ms, 95))
    mean_lat = float(np.mean(latencies_ms))
    min_lat = float(np.min(latencies_ms))
    max_lat = float(np.max(latencies_ms))

    print(f"Total sequential calls: {n_calls}")
    print(f"Median latency: {median_lat:.2f} ms")
    print(f"p95 latency:    {p95_lat:.2f} ms")
    print(f"Mean latency:   {mean_lat:.2f} ms")
    print(f"Min latency:    {min_lat:.2f} ms")
    print(f"Max latency:    {max_lat:.2f} ms")

if __name__ == "__main__":
    benchmark()

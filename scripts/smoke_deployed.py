"""Smoke test for deployed or running TrustHeart 3D service.

Usage:
    python scripts/smoke_deployed.py <base_url>
Example:
    python scripts/smoke_deployed.py http://127.0.0.1:8007
"""

import http.client
import json
import sys
import time
import urllib.parse
import urllib.request
import urllib.error

def make_request(url: str, method: str = "GET", data: dict = None, headers: dict = None):
    req_headers = headers.copy() if headers else {}
    body = None
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        req_headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=body, headers=req_headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            content = resp.read().decode("utf-8")
            status = resp.status
            resp_headers = dict(resp.headers)
            try:
                parsed_json = json.loads(content)
            except Exception:
                parsed_json = None
            return status, parsed_json, content, resp_headers
    except urllib.error.HTTPError as e:
        content = e.read().decode("utf-8")
        try:
            parsed_json = json.loads(content)
        except Exception:
            parsed_json = None
        return e.code, parsed_json, content, dict(e.headers)
    except Exception as e:
        return 0, None, str(e), {}

def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/smoke_deployed.py <base_url>")
        sys.exit(1)

    base_url = sys.argv[1].rstrip("/")
    print("=" * 75)
    print(f"TRUSTHEART 3D DEPLOYMENT SMOKE TEST: {base_url}")
    print("=" * 75)

    failures = 0

    # 1. GET /
    status, _, body, _ = make_request(f"{base_url}/")
    if status == 200 and ("<!doctype html>" in body.lower() or "<html" in body.lower()):
        print("PASS: GET / returned 200 with HTML frontend.")
    else:
        print(f"FAIL: GET / returned status {status}")
        failures += 1

    # 2. GET /api/health (assert models_verified true)
    status, health_json, _, _ = make_request(f"{base_url}/api/health")
    if status == 200 and health_json and health_json.get("models_verified") is True:
        print(f"PASS: GET /api/health returned 200 and models_verified=True (version: {health_json.get('model_version')}).")
    else:
        print(f"FAIL: GET /api/health returned status {status}, models_verified={health_json.get('models_verified') if health_json else 'N/A'}")
        failures += 1

    # 3. GET /api/samples
    status, samples_json, _, _ = make_request(f"{base_url}/api/samples")
    sample_0 = None
    if status == 200 and samples_json and "samples" in samples_json and len(samples_json["samples"]) > 0:
        sample_0 = samples_json["samples"][0]
        print(f"PASS: GET /api/samples returned {len(samples_json['samples'])} sample cases.")
    else:
        print(f"FAIL: GET /api/samples returned status {status}")
        failures += 1

    # 4. POST /api/predict quick mode for sample 0
    if sample_0:
        payload_quick = {"mode": "quick", "inputs": sample_0["inputs"]}
        status, quick_json, _, _ = make_request(f"{base_url}/api/predict", method="POST", data=payload_quick)
        vessels = ["CAD", "LAD", "LCX", "RCA"]
        if status == 200 and quick_json and all(v in quick_json.get("predictions", {}) for v in vessels):
            print("PASS: POST /api/predict (mode: quick) returned 200 with all 4 vessel keys (CAD, LAD, LCX, RCA).")
        else:
            print(f"FAIL: POST /api/predict quick returned status {status}, data: {quick_json}")
            failures += 1
    else:
        print("FAIL: Cannot test quick predict (sample 0 missing).")
        failures += 1

    # 5. POST /api/predict full mode for sample 0
    if sample_0:
        payload_full = {"mode": "full", "inputs": sample_0["inputs"]}
        status, full_json, _, _ = make_request(f"{base_url}/api/predict", method="POST", data=payload_full)
        vessels = ["CAD", "LAD", "LCX", "RCA"]
        if status == 200 and full_json and all(v in full_json.get("predictions", {}) for v in vessels):
            print("PASS: POST /api/predict (mode: full) returned 200 with all 4 vessel keys (CAD, LAD, LCX, RCA).")
        else:
            print(f"FAIL: POST /api/predict full returned status {status}, data: {full_json}")
            failures += 1
    else:
        print("FAIL: Cannot test full predict (sample 0 missing).")
        failures += 1

    # 6. POST /api/predict with NaN-free invalid input expecting 422
    invalid_payload = {
        "mode": "quick",
        "inputs": {
            "Age": 250,  # Physiologically impossible, exceeds max bound (120)
            "Sex": "Male",
        },
    }
    status, inv_json, _, _ = make_request(f"{base_url}/api/predict", method="POST", data=invalid_payload)
    if status == 422:
        print(f"PASS: POST /api/predict with out-of-bounds input returned 422 Unprocessable Entity.")
    else:
        print(f"FAIL: POST /api/predict with invalid input expected 422, got {status}")
        failures += 1

    # 7. Rate limit proxy-hop test: 70 rapid requests with rotating left-most XFF
    print("\n--- Rate Limiting & Proxy Hop Check (70 rapid requests) ---")
    hit_429 = False
    status_counts = {}
    fixed_appended_ip = "198.51.100.55"

    parsed = urllib.parse.urlparse(base_url)
    is_https = parsed.scheme == "https"
    port = parsed.port or (443 if is_https else 80)
    conn_cls = http.client.HTTPSConnection if is_https else http.client.HTTPConnection

    for i in range(70):
        # Fake XFF: rotate left-most client IP, append fixed real client IP to the right
        xff_header = f"fake.client.{i}, {fixed_appended_ip}"
        try:
            conn = conn_cls(parsed.hostname, port, timeout=5)
            conn.request("GET", "/api/health", headers={"X-Forwarded-For": xff_header, "Connection": "close"})
            r = conn.getresponse()
            s = r.status
            r.read()
            conn.close()
        except Exception:
            s = 0
        status_counts[s] = status_counts.get(s, 0) + 1
        if s == 429:
            hit_429 = True

    if hit_429:
        print(f"INFO: Rate limiter triggered 429 under rotating left-most XFF (proxy hops active and effective).")
    else:
        print(f"INFO: Rate limiter did NOT trigger 429 (service may not have TRUSTHEART_TRUST_PROXY=true or limit > 70).")
    print(f"INFO: Status code distribution across 70 requests: {status_counts}")

    print("-" * 75)
    if failures == 0:
        print("ALL CRITICAL SMOKE CHECKS PASSED.")
        sys.exit(0)
    else:
        print(f"FAILED: {failures} critical smoke check(s) failed.")
        sys.exit(1)

if __name__ == "__main__":
    main()

"""Verify that runtime files are not excluded by .dockerignore and are included in Dockerfile COPY instructions."""

import fnmatch
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

def parse_dockerignore(path: Path) -> list[str]:
    patterns = []
    if not path.is_file():
        return patterns
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            patterns.append(line)
    return patterns

def is_ignored(rel_path: str, patterns: list[str]) -> bool:
    # Normalize with forward slashes
    norm_path = rel_path.replace("\\", "/")
    path_parts = norm_path.split("/")
    for pat in patterns:
        pat_clean = pat.rstrip("/")
        # Check direct pattern match
        if fnmatch.fnmatch(norm_path, pat) or fnmatch.fnmatch(norm_path, pat_clean):
            return True
        # Check directory prefix
        if any(fnmatch.fnmatch(part, pat_clean) for part in path_parts):
            return True
        if norm_path.startswith(pat_clean + "/"):
            return True
    return False

def parse_dockerfile_copies(path: Path) -> list[dict]:
    copies = []
    if not path.is_file():
        return copies
    copy_regex = re.compile(r"^COPY\s+(?:--from=([^\s]+)\s+)?([^\s]+)\s+([^\s]+)", re.MULTILINE)
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    for match in copy_regex.finditer(content):
        stage, src, dest = match.groups()
        copies.append({
            "stage": stage,
            "src": src.strip("./").rstrip("/"),
            "dest": dest.strip("./").rstrip("/"),
        })
    return copies

def is_copied(rel_path: str, copies: list[dict]) -> bool:
    norm_path = rel_path.replace("\\", "/").lstrip("./")
    for cp in copies:
        src = cp["src"]
        dest = cp["dest"]
        # Exact match or directory prefix
        if norm_path == src or norm_path.startswith(src + "/"):
            return True
        # Stage destination matching (e.g. frontend/dist)
        if norm_path == dest or norm_path.startswith(dest + "/"):
            return True
        # Top-level directory prefix match (e.g. src="data" matching "data/raw/...")
        src_dir = src.split("/")[-1]
        if norm_path.startswith(src_dir + "/"):
            return True
    return False

def main():
    runtime_files_path = REPO_ROOT / "docs" / "verification" / "runtime_files.txt"
    dockerignore_path = REPO_ROOT / ".dockerignore"
    dockerfile_path = REPO_ROOT / "Dockerfile"

    if not runtime_files_path.is_file():
        print(f"FAIL: Runtime files list not found at {runtime_files_path}")
        sys.exit(1)

    with open(runtime_files_path, "r", encoding="utf-8") as f:
        runtime_files = [line.strip() for line in f if line.strip()]

    ignore_patterns = parse_dockerignore(dockerignore_path)
    dockerfile_copies = parse_dockerfile_copies(dockerfile_path)

    all_passed = True
    print(f"Checking {len(runtime_files)} runtime files against .dockerignore and Dockerfile COPY:")
    print("-" * 75)

    for rf in runtime_files:
        ignored = is_ignored(rf, ignore_patterns)
        copied = is_copied(rf, dockerfile_copies)

        if ignored:
            print(f"FAIL: {rf} is excluded by .dockerignore")
            all_passed = False
        elif not copied:
            print(f"FAIL: {rf} is NOT copied by Dockerfile")
            all_passed = False
        else:
            print(f"PASS: {rf} (not ignored, COPY'd)")

    print("-" * 75)
    if all_passed:
        print(f"ALL {len(runtime_files)} RUNTIME FILES PASSED (context verified).")
        sys.exit(0)
    else:
        print("FAIL: One or more runtime files failed context check.")
        sys.exit(1)

if __name__ == "__main__":
    main()

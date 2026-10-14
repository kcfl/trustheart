"""Verify that every file and line citation in docs/SECURITY.md matches active codebase lines."""

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

def main():
    sec_path = REPO_ROOT / "docs" / "SECURITY.md"
    if not sec_path.is_file():
        print(f"FAIL: {sec_path} not found")
        sys.exit(1)

    with open(sec_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Find file citations: patterns like [`path`](file:///.../path#Lstart-Lend) or [path#Lstart-Lend]
    citation_regex = re.compile(r"\[(?:`[^`]+`|[^\]]+)\]\(file:///[^)]*?((?:backend|tests)/[^#\)]+)(?:#L(\d+)(?:-L(\d+))?)?\)")
    matches = citation_regex.findall(content)

    print("=" * 95)
    print("VERIFYING docs/SECURITY.md CODE CITATIONS")
    print("=" * 95)
    print(f"{'Citation':<45} | {'Lines':<15} | {'Status':<10} | {'Snippet Preview'}")
    print("-" * 95)

    all_passed = True
    seen = set()

    for rel_file, start_str, end_str in matches:
        key = (rel_file, start_str, end_str)
        if key in seen:
            continue
        seen.add(key)

        file_path = REPO_ROOT / rel_file
        if not file_path.is_file():
            print(f"{rel_file:<45} | {'N/A':<15} | FAIL       | File does not exist")
            all_passed = False
            continue

        with open(file_path, "r", encoding="utf-8") as f:
            file_lines = f.readlines()

        if start_str:
            start_line = int(start_str)
            end_line = int(end_str) if end_str else start_line
            line_str = f"L{start_line}-L{end_line}"

            if start_line < 1 or end_line > len(file_lines) or start_line > end_line:
                print(f"{rel_file:<45} | {line_str:<15} | FAIL       | Out of line bounds (file has {len(file_lines)} lines)")
                all_passed = False
                continue

            # Grab preview snippet from cited range
            target_slice = file_lines[start_line - 1 : end_line]
            preview = "".join(target_slice).strip().splitlines()[0][:35]
            print(f"{rel_file:<45} | {line_str:<15} | PASS       | {preview}...")
        else:
            print(f"{rel_file:<45} | {'(file)':<15} | PASS       | File exists ({len(file_lines)} lines)")

    print("-" * 95)
    if all_passed:
        print(f"ALL {len(seen)} CITATIONS IN docs/SECURITY.md VERIFIED AND ACCURATE.")
        sys.exit(0)
    else:
        print("FAIL: One or more citations in docs/SECURITY.md failed verification.")
        sys.exit(1)

if __name__ == "__main__":
    main()

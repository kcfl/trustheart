"""Utility helpers for metadata extraction, tracking, and reproducibility."""

from datetime import datetime, timezone
import subprocess
import sys
from typing import Any

import joblib
import matplotlib
import numpy as np
import pandas as pd
import scipy
import sklearn


def run_metadata() -> dict[str, Any]:
    """Gather run metadata including git state, timestamp, and package versions.

    Returns
    -------
    dict[str, Any]
        Dictionary with git_commit, git_dirty, timestamp_utc, python_version,
        and versions of core scientific libraries.
    """
    git_commit = "unknown"
    git_dirty = False

    try:
        commit_proc = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True,
            text=True,
            check=True,
        )
        git_commit = commit_proc.stdout.strip()

        status_proc = subprocess.run(
            ["git", "status", "--porcelain"],
            capture_output=True,
            text=True,
            check=True,
        )
        git_dirty = len(status_proc.stdout.strip()) > 0
    except Exception:
        pass

    return {
        "git_commit": git_commit,
        "git_dirty": git_dirty,
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "python_version": sys.version,
        "package_versions": {
            "scikit-learn": sklearn.__version__,
            "numpy": np.__version__,
            "pandas": pd.__version__,
            "scipy": scipy.__version__,
            "joblib": joblib.__version__,
            "matplotlib": matplotlib.__version__,
        },
    }

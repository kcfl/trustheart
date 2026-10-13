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

from ml.config import INNER_REPEATS, INNER_SPLITS, LR_C_GRID, N_REPEATS_NESTED


def run_metadata() -> dict[str, Any]:
    """Gather run metadata including git state, timestamp, package versions, and CV configs.

    Returns
    -------
    dict[str, Any]
        Dictionary with git_commit, git_dirty, timestamp_utc, python_version,
        versions of core scientific libraries, and nested CV search parameters.
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

        # Compute git_dirty ignoring generated artifact folders
        status_proc = subprocess.run(
            ["git", "status", "--porcelain", "--", ".", ":!models", ":!reports"],
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
        "n_repeats_nested": N_REPEATS_NESTED,
        "inner_splits": INNER_SPLITS,
        "inner_repeats": INNER_REPEATS,
        "lr_c_grid": list(LR_C_GRID),
        "package_versions": {
            "scikit-learn": sklearn.__version__,
            "numpy": np.__version__,
            "pandas": pd.__version__,
            "scipy": scipy.__version__,
            "joblib": joblib.__version__,
            "matplotlib": matplotlib.__version__,
        },
    }

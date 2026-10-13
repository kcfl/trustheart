"""Patient similarity search, k-nearest neighbors clinical evidence, and LOO evaluation."""

from typing import Any, Sequence
import numpy as np
import pandas as pd
from scipy.spatial.distance import cdist
from sklearn.metrics import roc_auc_score

from ml.config import (
    COMPACT_FEATURES,
    KNN_K_EVIDENCE,
    N_SIMILAR_SHOWN,
    TARGETS,
)
from ml.data import drop_constant_columns, load_features, load_raw, load_targets


def get_age_band(age: float | int) -> str:
    """Compute 5-year age band string from numeric age (e.g. 58 -> '55-59')."""
    base = int(float(age) // 5 * 5)
    return f"{base}-{base + 4}"


class SimilarPatients:
    """Find clinically similar historical patients via Euclidean distance on feature z-scores."""

    def __init__(self, X_train: pd.DataFrame, Y: pd.DataFrame) -> None:
        """Initialize patient similarity index.

        Parameters
        ----------
        X_train : pd.DataFrame
            Feature training matrix.
        Y : pd.DataFrame
            Ground-truth binary outcomes dataframe for targets (CAD, LAD, LCX, RCA).
        """
        self.X: pd.DataFrame = X_train.copy()
        self.Y: pd.DataFrame = Y.copy()

        # Compute and store per-column mean and standard deviation
        self.mean: pd.Series = self.X.mean(axis=0)
        self.std: pd.Series = self.X.std(axis=0, ddof=1)
        # Any zero std is replaced with 1.0 to prevent division by zero
        self.std = self.std.replace(0.0, 1.0)
        self.std.fillna(1.0, inplace=True)

    def query(
        self,
        x_row: pd.Series | pd.DataFrame | dict[str, Any],
        available_cols: Sequence[str],
        k: int = N_SIMILAR_SHOWN,
        exclude_index: Any = None,
    ) -> list[dict[str, Any]]:
        """Find the top-k nearest patients based on Euclidean distance on standardized z-scores.

        Parameters
        ----------
        x_row : pd.Series, pd.DataFrame, or dict
            Query patient record.
        available_cols : Sequence[str]
            Subset of columns to use for distance calculation (e.g. compact 7 or full 55).
        k : int, optional
            Number of similar patients to return, by default N_SIMILAR_SHOWN (5).
        exclude_index : Any, optional
            Row index to exclude from the candidate pool (e.g. in leave-one-out evaluation).

        Returns
        -------
        list[dict[str, Any]]
            List of k dictionaries containing ONLY:
            case_id, distance, age_band, sex, outcomes.
        """
        cols = list(available_cols)

        # Extract query vector
        if isinstance(x_row, pd.DataFrame):
            q_vec = x_row.iloc[0][cols].to_numpy(dtype=float)
        elif isinstance(x_row, pd.Series):
            q_vec = x_row[cols].to_numpy(dtype=float)
        elif isinstance(x_row, dict):
            q_vec = np.array([x_row[c] for c in cols], dtype=float)
        else:
            raise TypeError(f"Unsupported query type: {type(x_row)}")

        # Standardize query
        mean_sub = self.mean[cols].to_numpy(dtype=float)
        std_sub = self.std[cols].to_numpy(dtype=float)
        z_query = (q_vec - mean_sub) / std_sub

        # Standardize database
        X_sub = self.X[cols].to_numpy(dtype=float)
        Z_db = (X_sub - mean_sub) / std_sub

        # Compute Euclidean distances
        dists = np.sqrt(np.sum((Z_db - z_query) ** 2, axis=1))

        # Build candidate indices, filtering out exclude_index
        candidate_indices = []
        for loc_idx, row_idx in enumerate(self.X.index):
            if exclude_index is not None and row_idx == exclude_index:
                continue
            candidate_indices.append((loc_idx, row_idx, dists[loc_idx]))

        # Sort by distance
        candidate_indices.sort(key=lambda item: item[2])
        top_k = candidate_indices[:k]

        results: list[dict[str, Any]] = []
        for loc_idx, row_idx, dist in top_k:
            raw_row = self.X.iloc[loc_idx]
            y_row = self.Y.iloc[loc_idx]

            age_val = raw_row.get("Age", 0)
            sex_val = raw_row.get("Sex", 0)
            sex_str = "M" if int(sex_val) == 1 else "F"

            outcomes_dict = {
                target: int(y_row[target])
                for target in ["CAD", "LAD", "LCX", "RCA"]
            }

            res_dict = {
                "case_id": int(row_idx) if isinstance(row_idx, (int, np.integer)) else row_idx,
                "distance": float(round(dist, 4)),
                "age_band": get_age_band(age_val),
                "sex": sex_str,
                "outcomes": outcomes_dict,
            }
            results.append(res_dict)

        return results

    def knn_estimate(
        self,
        x_row: pd.Series | pd.DataFrame | dict[str, Any],
        available_cols: Sequence[str],
        k: int = KNN_K_EVIDENCE,
        exclude_index: Any = None,
    ) -> dict[str, float]:
        """Compute empirical target probabilities as fractions of outcome 1 among k nearest neighbours.

        Parameters
        ----------
        x_row : pd.Series, pd.DataFrame, or dict
            Query patient record.
        available_cols : Sequence[str]
            Subset of columns to use.
        k : int, optional
            Number of neighbors for empirical evidence, by default KNN_K_EVIDENCE (15).
        exclude_index : Any, optional
            Row index to exclude from neighbors.

        Returns
        -------
        dict[str, float]
            Mapping from target name to fraction of neighbors with positive outcome.
        """
        neighbors = self.query(x_row, available_cols, k=k, exclude_index=exclude_index)
        n_neighbors = len(neighbors)
        if n_neighbors == 0:
            return {t: 0.0 for t in ["CAD", "LAD", "LCX", "RCA"]}

        estimates = {}
        for target in ["CAD", "LAD", "LCX", "RCA"]:
            count_pos = sum(n["outcomes"][target] for n in neighbors)
            estimates[target] = float(count_pos / n_neighbors)

        return estimates


def loo_evidence_auc(
    featureset_name: str,
    columns: Sequence[str] | None = None,
    k: int = KNN_K_EVIDENCE,
) -> dict[str, float]:
    """Compute Leave-One-Out (LOO) ROC-AUC per target using k-NN empirical evidence estimates.

    Parameters
    ----------
    featureset_name : str
        Name of featureset ('compact' or 'full').
    columns : Sequence[str] | None, optional
        Explicit columns to use. If None, derived from featureset_name.
    k : int, optional
        Neighborhood size, by default KNN_K_EVIDENCE (15).

    Returns
    -------
    dict[str, float]
        Mapping from target name to LOO ROC-AUC score.
    """
    raw_df = load_raw()
    targets_df = load_targets(raw_df)
    clean_features, _ = drop_constant_columns(load_features(raw_df))

    if columns is None:
        if featureset_name == "compact":
            cols = list(COMPACT_FEATURES)
        else:
            cols = list(clean_features.columns)
    else:
        cols = list(columns)

    sp = SimilarPatients(clean_features, targets_df)
    n_samples = len(clean_features)

    # Collect LOO predictions for each sample
    pred_targets: dict[str, list[float]] = {t: [] for t in TARGETS}

    for idx in range(n_samples):
        row = clean_features.iloc[idx]
        row_id = clean_features.index[idx]
        est = sp.knn_estimate(row, cols, k=k, exclude_index=row_id)
        for t in TARGETS:
            pred_targets[t].append(est[t])

    auc_scores: dict[str, float] = {}
    for t in TARGETS:
        y_true = targets_df[t].values
        p_est = np.array(pred_targets[t])
        auc_scores[t] = float(roc_auc_score(y_true, p_est))

    return auc_scores

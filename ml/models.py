"""Model factory module for TrustHeart 3D.

Returns fresh, reproducible scikit-learn estimators and pipelines.

Note on Hyperparameters:
Fixed baseline hyperparameters are configured in this module as specified
for Step 2 evaluation (Logistic Regression C=0.1 with StandardScaler in a Pipeline,
and Random Forest with 300 estimators, min_samples_leaf=2, class_weight='balanced_subsample').
Formal hyperparameter tuning and threshold calibration will be introduced in Step 3.
"""

from typing import Any
from sklearn.base import BaseEstimator
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from ml.config import SEED


def get_model(name: str, seed: int = SEED) -> BaseEstimator:
    """Return a fresh instance of the specified model pipeline or estimator.

    Parameters
    ----------
    name : str
        Model identifier: 'LR' (Logistic Regression pipeline) or 'RF' (Random Forest).
    seed : int, optional
        Random seed for model reproducibility, by default ml.config.SEED.

    Returns
    -------
    BaseEstimator
        Unfitted scikit-learn estimator or Pipeline.

    Raises
    ------
    ValueError
        If the model name is unknown.
    """
    key = name.upper().strip()

    if key == "LR":
        # All preprocessing (StandardScaler) lives inside the Pipeline so
        # it is fitted strictly on training folds.
        return Pipeline(
            [
                ("scaler", StandardScaler()),
                (
                    "classifier",
                    LogisticRegression(
                        C=0.1,
                        max_iter=5000,
                        class_weight="balanced",
                        random_state=seed,
                    ),
                ),
            ]
        )
    elif key == "RF":
        # RandomForestClassifier with fixed parameters; n_jobs=1 to avoid
        # thread oversubscription during outer parallel fold execution.
        return RandomForestClassifier(
            n_estimators=300,
            min_samples_leaf=2,
            class_weight="balanced_subsample",
            random_state=seed,
            n_jobs=1,
        )
    else:
        raise ValueError(
            f"Unknown model name '{name}'. Available model keys: ['LR', 'RF']."
        )

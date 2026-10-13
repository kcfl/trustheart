"""Search space definitions, configuration dataclasses, and model builders."""

from dataclasses import dataclass
from typing import Any
from sklearn.base import BaseEstimator
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from ml.config import SEED


@dataclass(frozen=True)
class Config:
    """Immutable model and hyperparameter configuration specification."""

    name: str
    featureset: str  # 'compact' or 'full'
    model: str  # 'LR' or 'RF'
    params: dict[str, Any]


def complexity_key(config: Config) -> tuple[int, tuple[float, int]]:
    """Compute complexity order key for model selection.

    Ordering rule:
        Primary rank: model_rank * 2 + featureset_rank
            - model_rank: LR = 0, RF = 1
            - featureset_rank: compact = 0, full = 1
            => compact-LR (0) < full-LR (1) < compact-RF (2) < full-RF (3)
        Tiebreak:
            - For LR: smaller C is simpler (use C)
            - For RF: larger min_samples_leaf is simpler (use -min_samples_leaf);
                      for equal leaf, 'sqrt' is simpler than 0.3.

    Lower key = simpler model.

    Parameters
    ----------
    config : Config
        The configuration to score.

    Returns
    -------
    tuple[int, tuple[float, int]]
        Hierarchical complexity tuple.
    """
    model_rank = 0 if config.model == "LR" else 1
    featureset_rank = 0 if config.featureset == "compact" else 1
    primary_rank = model_rank * 2 + featureset_rank

    if config.model == "LR":
        tiebreak = (float(config.params["C"]), 0)
    else:
        leaf = float(config.params["min_samples_leaf"])
        # 'sqrt' is simpler than 0.3
        feat_rank = 0 if config.params["max_features"] == "sqrt" else 1
        tiebreak = (-leaf, feat_rank)

    return (primary_rank, tiebreak)


def build_estimator(config: Config) -> BaseEstimator:
    """Instantiate a fresh scikit-learn estimator or pipeline for the given config.

    Parameters
    ----------
    config : Config
        Configuration specifying model family and hyperparameters.

    Returns
    -------
    BaseEstimator
        Unfitted Pipeline or RandomForestClassifier.
    """
    if config.model == "LR":
        return Pipeline(
            [
                ("scaler", StandardScaler()),
                (
                    "classifier",
                    LogisticRegression(
                        C=config.params["C"],
                        class_weight="balanced",
                        max_iter=5000,
                        random_state=SEED,
                    ),
                ),
            ]
        )
    elif config.model == "RF":
        return RandomForestClassifier(
            n_estimators=300,
            min_samples_leaf=config.params["min_samples_leaf"],
            max_features=config.params["max_features"],
            class_weight="balanced_subsample",
            random_state=SEED,
            n_jobs=1,
        )
    else:
        raise ValueError(f"Unknown model family '{config.model}' in config.")


def build_all_configs() -> list[Config]:
    """Generate the full list of 18 configurations (9 compact, 9 full).

    Returns
    -------
    list[Config]
        List of 18 Config objects.
    """
    configs: list[Config] = []
    lr_c_values = [0.01, 0.03, 0.1, 0.3, 1.0]
    rf_leaves = [2, 5]
    rf_max_features = ["sqrt", 0.3]

    for f_set in ["compact", "full"]:
        # 5 LR configs
        for c in lr_c_values:
            name = f"{f_set}|LR|C={c}"
            configs.append(
                Config(
                    name=name,
                    featureset=f_set,
                    model="LR",
                    params={"C": c},
                )
            )

        # 4 RF configs
        for leaf in rf_leaves:
            for feat in rf_max_features:
                name = f"{f_set}|RF|leaf={leaf}|feat={feat}"
                configs.append(
                    Config(
                        name=name,
                        featureset=f_set,
                        model="RF",
                        params={"min_samples_leaf": leaf, "max_features": feat},
                    )
                )

    return configs


ALL_CONFIGS: list[Config] = build_all_configs()


def get_space_configs(space: str) -> list[Config]:
    """Retrieve configurations belonging to a specific search space.

    Parameters
    ----------
    space : str
        'auto' (all 18 configs: compact + full) or 'quick' (9 compact configs only).

    Returns
    -------
    list[Config]
        Filtered list of configs.

    Raises
    ------
    ValueError
        If space name is unrecognized.
    """
    sp = space.lower().strip()
    if sp == "auto":
        return list(ALL_CONFIGS)
    elif sp == "quick":
        return [c for c in ALL_CONFIGS if c.featureset == "compact"]
    else:
        raise ValueError(f"Unknown search space '{space}'. Expected 'auto' or 'quick'.")

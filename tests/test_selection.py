"""Unit tests for the 1-SE model selection heuristic and complexity ordering."""

import numpy as np
import pytest

from ml.search_space import Config, complexity_key
from ml.select import select_config


def test_complexity_key_hierarchy() -> None:
    """Verify primary complexity hierarchy: compact-LR < full-LR < compact-RF < full-RF."""
    compact_lr = Config(name="compact|LR|C=0.1", featureset="compact", model="LR", params={"C": 0.1})
    full_lr = Config(name="full|LR|C=0.1", featureset="full", model="LR", params={"C": 0.1})
    compact_rf = Config(
        name="compact|RF|leaf=5|feat=sqrt",
        featureset="compact",
        model="RF",
        params={"min_samples_leaf": 5, "max_features": "sqrt"},
    )
    full_rf = Config(
        name="full|RF|leaf=5|feat=sqrt",
        featureset="full",
        model="RF",
        params={"min_samples_leaf": 5, "max_features": "sqrt"},
    )

    key_c_lr = complexity_key(compact_lr)
    key_f_lr = complexity_key(full_lr)
    key_c_rf = complexity_key(compact_rf)
    key_f_rf = complexity_key(full_rf)

    assert key_c_lr < key_f_lr, f"{key_c_lr} should be < {key_f_lr}"
    assert key_f_lr < key_c_rf, f"{key_f_lr} should be < {key_c_rf}"
    assert key_c_rf < key_f_rf, f"{key_c_rf} should be < {key_f_rf}"


def test_complexity_key_tiebreaks() -> None:
    """Verify tie-breaker ordering for LR (smaller C) and RF (larger leaf, then sqrt vs 0.3)."""
    # For LR, smaller C is simpler
    lr_c0001 = Config("compact|LR|C=0.001", "compact", "LR", {"C": 0.001})
    lr_c0003 = Config("compact|LR|C=0.003", "compact", "LR", {"C": 0.003})
    lr_c001 = Config("compact|LR|C=0.01", "compact", "LR", {"C": 0.01})
    lr_c010 = Config("compact|LR|C=0.1", "compact", "LR", {"C": 0.1})
    lr_c100 = Config("compact|LR|C=1.0", "compact", "LR", {"C": 1.0})
    assert complexity_key(lr_c0001) < complexity_key(lr_c0003) < complexity_key(lr_c001) < complexity_key(lr_c010) < complexity_key(lr_c100)

    # For RF, larger min_samples_leaf is simpler (use -min_samples_leaf)
    rf_leaf5 = Config("compact|RF|leaf=5|feat=sqrt", "compact", "RF", {"min_samples_leaf": 5, "max_features": "sqrt"})
    rf_leaf2 = Config("compact|RF|leaf=2|feat=sqrt", "compact", "RF", {"min_samples_leaf": 2, "max_features": "sqrt"})
    assert complexity_key(rf_leaf5) < complexity_key(rf_leaf2)

    # For RF with equal leaf, 'sqrt' is simpler than 0.3
    rf_sqrt = Config("compact|RF|leaf=5|feat=sqrt", "compact", "RF", {"min_samples_leaf": 5, "max_features": "sqrt"})
    rf_frac = Config("compact|RF|leaf=5|feat=0.3", "compact", "RF", {"min_samples_leaf": 5, "max_features": 0.3})
    assert complexity_key(rf_sqrt) < complexity_key(rf_frac)


def test_select_config_simpler_within_one_se() -> None:
    """Verify that a simpler config within 1 standard error of the best is chosen over the best."""
    cfg_simple = Config("compact|LR|C=0.01", "compact", "LR", {"C": 0.01})
    cfg_best = Config("full|RF|leaf=2|feat=0.3", "full", "RF", {"min_samples_leaf": 2, "max_features": 0.3})

    # cfg_best scores: mean = 0.90, std = 0.0245, se = 0.01
    # best_mean - 1*SE = 0.89
    scores_best = np.array([0.90, 0.92, 0.88, 0.91, 0.87, 0.92])
    # cfg_simple has mean 0.892 (which is >= 0.89)
    scores_simple = np.array([0.892, 0.892, 0.892, 0.892, 0.892, 0.892])

    scores = {
        cfg_simple.name: scores_simple,
        cfg_best.name: scores_best,
    }

    selected = select_config(scores, [cfg_simple, cfg_best])
    assert selected.name == cfg_simple.name


def test_select_config_best_chosen_when_beyond_one_se() -> None:
    """Verify that when the best config is clearly ahead (> 1 SE), it is selected."""
    cfg_simple = Config("compact|LR|C=0.01", "compact", "LR", {"C": 0.01})
    cfg_best = Config("full|RF|leaf=2|feat=0.3", "full", "RF", {"min_samples_leaf": 2, "max_features": 0.3})

    # cfg_best scores: mean = 0.90, se ~ 0.01 -> cutoff ~ 0.89
    scores_best = np.array([0.90, 0.92, 0.88, 0.91, 0.87, 0.92])
    # cfg_simple is below 0.89
    scores_simple = np.array([0.85, 0.85, 0.85, 0.85, 0.85, 0.85])

    scores = {
        cfg_simple.name: scores_simple,
        cfg_best.name: scores_best,
    }

    selected = select_config(scores, [cfg_simple, cfg_best])
    assert selected.name == cfg_best.name


def test_select_config_tie_breaking() -> None:
    """Verify that when multiple configs are eligible, the one with lowest complexity_key is chosen."""
    cfg1 = Config("compact|LR|C=0.01", "compact", "LR", {"C": 0.01})
    cfg2 = Config("compact|LR|C=0.1", "compact", "LR", {"C": 0.1})

    # Exactly identical scores
    scores = {
        cfg1.name: np.array([0.85, 0.86, 0.84, 0.85, 0.86, 0.84]),
        cfg2.name: np.array([0.85, 0.86, 0.84, 0.85, 0.86, 0.84]),
    }

    selected = select_config(scores, [cfg2, cfg1])
    assert selected.name == cfg1.name


def test_config_counts_and_grid() -> None:
    """Verify total configs, compact/full splits, LR grid values, and RF configs."""
    from ml.config import LR_C_GRID
    from ml.search_space import ALL_CONFIGS, get_space_configs

    # Total 22 configs
    assert len(ALL_CONFIGS) == 22
    compact_cfgs = [c for c in ALL_CONFIGS if c.featureset == "compact"]
    full_cfgs = [c for c in ALL_CONFIGS if c.featureset == "full"]
    assert len(compact_cfgs) == 11
    assert len(full_cfgs) == 11

    # Search spaces
    assert len(get_space_configs("auto")) == 22
    assert len(get_space_configs("quick")) == 11

    # LR C grid has 7 values
    expected_c = [0.001, 0.003, 0.01, 0.03, 0.1, 0.3, 1.0]
    assert list(LR_C_GRID) == expected_c

    for f_set in ["compact", "full"]:
        lr_cfgs = [c for c in ALL_CONFIGS if c.featureset == f_set and c.model == "LR"]
        rf_cfgs = [c for c in ALL_CONFIGS if c.featureset == f_set and c.model == "RF"]
        assert len(lr_cfgs) == 7
        assert len(rf_cfgs) == 4
        assert [c.params["C"] for c in lr_cfgs] == expected_c

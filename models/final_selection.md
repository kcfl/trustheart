# TrustHeart 3D - Step 5: Final Model Selection & Calibration

Final models selected using the 1-SE simplicity heuristic on full dataset (303 samples, 6 inner folds).

| Space | Target | Selected Configuration | Featureset | Model Architecture | Features Used | Platt Slope (a) | Platt Intercept (b) |
|---|---|---|---|---|---|---|---|
| `auto` | **CAD** | `full|LR|C=0.001` | `full` | LR | 55 | 12.3628 | 0.9704 |
| `quick` | **CAD** | `compact|LR|C=0.001` | `compact` | LR | 7 | 13.7899 | 0.9356 |
| `auto` | **LAD** | `full|LR|C=0.001` | `full` | LR | 55 | 8.9140 | 0.3702 |
| `quick` | **LAD** | `compact|LR|C=0.001` | `compact` | LR | 7 | 11.4114 | 0.2925 |
| `auto` | **LCX** | `compact|LR|C=0.03` | `compact` | LR | 7 | 1.3056 | -0.4250 |
| `quick` | **LCX** | `compact|LR|C=0.03` | `compact` | LR | 7 | 1.3056 | -0.4250 |
| `auto` | **RCA** | `compact|LR|C=0.001` | `compact` | LR | 7 | 11.9557 | -0.5293 |
| `quick` | **RCA** | `compact|LR|C=0.001` | `compact` | LR | 7 | 11.9557 | -0.5293 |

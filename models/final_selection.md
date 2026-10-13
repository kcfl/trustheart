# TrustHeart 3D - Step 3: Final Model Selection & Calibration

Final models selected using the 1-SE simplicity heuristic on full dataset (303 samples, 6 inner folds).

| Space | Target | Selected Configuration | Featureset | Model Architecture | Features Used | Platt Slope (a) | Platt Intercept (b) |
|---|---|---|---|---|---|---|---|
| `auto` | **CAD** | `full|LR|C=0.01` | `full` | LR | 55 | 2.7683 | 0.9342 |
| `quick` | **CAD** | `compact|LR|C=0.01` | `compact` | LR | 7 | 2.6560 | 0.9214 |
| `auto` | **LAD** | `full|RF|leaf=5|feat=sqrt` | `full` | RF | 55 | 2.0462 | 0.0766 |
| `quick` | **LAD** | `compact|LR|C=0.01` | `compact` | LR | 7 | 2.1699 | 0.2959 |
| `auto` | **LCX** | `compact|LR|C=0.03` | `compact` | LR | 7 | 1.3056 | -0.4250 |
| `quick` | **LCX** | `compact|LR|C=0.03` | `compact` | LR | 7 | 1.3056 | -0.4250 |
| `auto` | **RCA** | `compact|LR|C=0.01` | `compact` | LR | 7 | 2.1824 | -0.5205 |
| `quick` | **RCA** | `compact|LR|C=0.01` | `compact` | LR | 7 | 2.1824 | -0.5205 |

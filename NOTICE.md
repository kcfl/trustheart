# Notice & Third-Party Attributions

## 1. Dataset Citation & Attribution

This project utilizes the **Extension of Z-Alizadeh Sani Dataset**, published by Alizadeh Sani et al. and distributed via the UCI Machine Learning Repository.

- **Dataset Title**: Extension of Z-Alizadeh Sani Dataset
- **Repository**: UCI Machine Learning Repository (Dataset ID 411)
- **DOI**: [10.24432/C5461K](https://doi.org/10.24432/C5461K)
- **Citation**: Alizadeh Sani, Z. (2018). *Extension of Z-Alizadeh Sani Dataset*. UCI Machine Learning Repository.
- **Original Reference Paper**: Alizadeh Sani, Z., et al. (2013). *Computer aided diagnosis of coronary artery disease: a software engineer's perspective*. Computer Methods and Programs in Biomedicine, 111(1), 105-119.
- **License**: Creative Commons Attribution 4.0 International ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)).

---

## 2. Python Runtime Libraries & Licenses

The backend production container runs using the following runtime packages (listed in `requirements-runtime.txt`). Package licenses have been extracted programmatically from installed package metadata:

| Package | Version | License |
|---|---|---|
| `annotated-doc` | `0.0.5` | MIT |
| `annotated-types` | `0.8.0` | MIT |
| `anyio` | `4.15.1` | MIT |
| `click` | `8.5.0` | BSD-3-Clause |
| `cloudpickle` | `3.1.2` | BSD-3-Clause |
| `et_xmlfile` | `2.0.0` | MIT |
| `fastapi` | `0.143.0` | MIT |
| `h11` | `0.16.0` | MIT |
| `idna` | `3.20` | BSD-3-Clause |
| `joblib` | `1.6.0` | BSD-3-Clause |
| `narwhals` | `2.27.1` | MIT |
| `numpy` | `2.5.4` | BSD-3-Clause AND 0BSD AND MIT AND Zlib AND CC0-1.0 |
| `openpyxl` | `3.1.5` | MIT |
| `opentelemetry-api` | `1.45.1` | Apache-2.0 |
| `packaging` | `26.3` | Apache-2.0 OR BSD-2-Clause |
| `pandas` | `3.0.6` | BSD License |
| `pydantic` | `2.14.1` | MIT |
| `pydantic_core` | `2.50.1` | MIT |
| `python-dateutil` | `2.9.0.post0` | Dual License |
| `scikit-learn` | `1.9.1` | BSD-3-Clause |
| `scipy` | `1.18.1` | BSD License |
| `six` | `1.17.0` | MIT |
| `starlette` | `1.8.0` | BSD-3-Clause |
| `threadpoolctl` | `3.7.0` | BSD-3-Clause |
| `typing-inspection` | `0.4.4` | MIT |
| `typing_extensions` | `4.16.0` | PSF-2.0 |
| `tzdata` | `2026.5` | Apache-2.0 |
| `uvicorn` | `0.54.0` | BSD-3-Clause |

---

## 3. Frontend Libraries & Attributions

The interactive 3D web application frontend bundles the following open-source client libraries (see `frontend/package.json` and [`frontend/THIRD_PARTY_NOTICES.md`](frontend/THIRD_PARTY_NOTICES.md)):
- **React** (`react`, `react-dom`): MIT License (Meta Platforms, Inc.).
- **Three.js** (`three`, `@types/three`): MIT License (Mr.doob and Three.js authors).
- **Lucide React** (`lucide-react`): ISC License (Lucide Contributors).
- **Vite** (build tool): MIT License (Evan You and Vite Contributors).
- **GSAP** & **Motion**: Animation and UI motion orchestration.

All application-specific code and algorithmic trust layers in this repository are authored by the TrustHeart 3D team.


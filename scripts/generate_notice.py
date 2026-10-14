"""Generate NOTICE.md containing dataset attribution, license details, and runtime libraries."""

import importlib.metadata
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

def get_package_license(dist: importlib.metadata.Distribution) -> str:
    # 1. Check License-Expression
    lic_expr = dist.metadata.get("License-Expression")
    if lic_expr:
        return lic_expr.strip()

    # 2. Check License field
    lic = dist.metadata.get("License")
    if lic and len(lic.strip()) < 50 and not lic.strip().startswith("Copyright"):
        return lic.strip()

    # 3. Check Classifiers
    classifiers = dist.metadata.get_all("Classifier") or []
    license_classifiers = [c.split("::")[-1].strip() for c in classifiers if "License" in c]
    if license_classifiers:
        # Prefer specific OSI licenses
        for lc in license_classifiers:
            if "License" not in lc and "OSI Approved" not in lc:
                return lc
        return license_classifiers[-1]

    if lic:
        first_line = lic.strip().split("\n")[0].strip()
        if len(first_line) < 50:
            return first_line

    return "Custom / See Package Details"

def main():
    req_file = REPO_ROOT / "requirements-runtime.txt"
    if not req_file.is_file():
        raise FileNotFoundError("requirements-runtime.txt not found")

    with open(req_file, "r", encoding="utf-8") as f:
        pkg_lines = [line.strip() for line in f if line.strip() and not line.startswith("#")]

    packages_info = []
    for line in pkg_lines:
        pkg_name = line.split("==")[0]
        try:
            dist = importlib.metadata.distribution(pkg_name)
            name = dist.metadata.get("Name", pkg_name)
            ver = dist.version
            lic = get_package_license(dist)
            packages_info.append({"name": name, "version": ver, "license": lic})
        except Exception as e:
            packages_info.append({"name": pkg_name, "version": "unknown", "license": f"Error: {e}"})

    lines = []
    lines.append("# Notice & Third-Party Attributions")
    lines.append("")
    lines.append("## 1. Dataset Citation & Attribution")
    lines.append("")
    lines.append("This project utilizes the **Extension of Z-Alizadeh Sani Dataset**, published by Alizadeh Sani et al. and distributed via the UCI Machine Learning Repository.")
    lines.append("")
    lines.append("- **Dataset Title**: Extension of Z-Alizadeh Sani Dataset")
    lines.append("- **Repository**: UCI Machine Learning Repository (Dataset ID 411)")
    lines.append("- **DOI**: [10.24432/C5461K](https://doi.org/10.24432/C5461K)")
    lines.append("- **Citation**: Alizadeh Sani, Z. (2018). *Extension of Z-Alizadeh Sani Dataset*. UCI Machine Learning Repository.")
    lines.append("- **Original Reference Paper**: Alizadeh Sani, Z., et al. (2013). *Computer aided diagnosis of coronary artery disease: a software engineer's perspective*. Computer Methods and Programs in Biomedicine, 111(1), 105-119.")
    lines.append("- **License**: Creative Commons Attribution 4.0 International ([CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)).")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 2. Python Runtime Libraries & Licenses")
    lines.append("")
    lines.append("The backend production container runs using the following runtime packages (listed in `requirements-runtime.txt`). Package licenses have been extracted programmatically from installed package metadata:")
    lines.append("")
    lines.append("| Package | Version | License |")
    lines.append("|---|---|---|")
    for p in packages_info:
        lines.append(f"| `{p['name']}` | `{p['version']}` | {p['license']} |")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("## 3. Frontend Libraries & Attributions")
    lines.append("")
    lines.append("The interactive 3D web application frontend bundles the following open-source client libraries (see `frontend/package.json`):")
    lines.append("- **React** (`react`, `react-dom`): MIT License (Meta Platforms, Inc.).")
    lines.append("- **Three.js** (`three`, `@types/three`): MIT License (Mr.doob and Three.js authors).")
    lines.append("- **Lucide React** (`lucide-react`): ISC License (Lucide Contributors).")
    lines.append("- **Vite** (build tool): MIT License (Evan You and Vite Contributors).")
    lines.append("")
    lines.append("All application-specific code and algorithmic trust layers in this repository are authored by the TrustHeart 3D team.")
    lines.append("")

    notice_path = REPO_ROOT / "NOTICE.md"
    with open(notice_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    print(f"Successfully generated {notice_path} ({len(packages_info)} runtime packages).")

if __name__ == "__main__":
    main()

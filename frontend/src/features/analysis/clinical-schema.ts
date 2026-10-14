/**
 * Clinical form schemas, feature ranges, and validation matching backend/app/schemas.py
 */

export const HARD_FEATURE_RANGES: Record<string, [number, number]> = {
  Age: [0.0, 120.0],
  Weight: [10.0, 400.0],
  Length: [50.0, 260.0],
  BMI: [10.0, 100.0],
  BP: [30.0, 300.0],
  PR: [30.0, 250.0],
  FBS: [20.0, 1200.0],
  CR: [0.1, 30.0],
  TG: [10.0, 3000.0],
  LDL: [5.0, 1000.0],
  HDL: [5.0, 300.0],
  BUN: [1.0, 300.0],
  ESR: [0.0, 200.0],
  HB: [3.0, 25.0],
  K: [1.0, 10.0],
  Na: [90.0, 200.0],
  WBC: [500.0, 150000.0],
  Lymph: [0.0, 100.0],
  Neut: [0.0, 100.0],
  PLT: [5.0, 2500.0],
  "EF-TTE": [5.0, 95.0],
  "Region RWMA": [0.0, 4.0],
  "Function Class": [0.0, 3.0],
};

export const BINARY_FEATURES = new Set([
  "DM",
  "HTN",
  "Current Smoker",
  "EX-Smoker",
  "FH",
  "Obesity",
  "CRF",
  "CVA",
  "Airway disease",
  "Thyroid Disease",
  "CHF",
  "DLP",
  "Edema",
  "Weak Peripheral Pulse",
  "Lung rales",
  "Systolic Murmur",
  "Diastolic Murmur",
  "Typical Chest Pain",
  "Dyspnea",
  "Atypical",
  "Nonanginal",
  "LowTH Ang",
  "Q Wave",
  "St Elevation",
  "St Depression",
  "Tinversion",
  "LVH",
  "Poor R Progression",
]);

export const CLINICAL_GROUPS: Record<
  string,
  { label: string; fields: { name: string; label: string; unit?: string; kind: "continuous" | "binary" | "categorical" | "ordinal"; options?: string[] }[] }
> = {
  Demographics: {
    label: "Demographics",
    fields: [
      { name: "Weight", label: "Weight", unit: "kg", kind: "continuous" },
      { name: "Length", label: "Length / Height", unit: "cm", kind: "continuous" },
      { name: "BMI", label: "Body Mass Index", unit: "kg/m²", kind: "continuous" },
    ],
  },
  History: {
    label: "History & Risk Factors",
    fields: [
      { name: "Current Smoker", label: "Current Smoker", kind: "binary" },
      { name: "EX-Smoker", label: "Ex-Smoker", kind: "binary" },
      { name: "FH", label: "Family History of CAD", kind: "binary" },
      { name: "Obesity", label: "Obesity", kind: "binary" },
      { name: "CRF", label: "Chronic Renal Failure", kind: "binary" },
      { name: "CVA", label: "Cerebrovascular Accident", kind: "binary" },
      { name: "Airway disease", label: "Airway Disease", kind: "binary" },
      { name: "Thyroid Disease", label: "Thyroid Disease", kind: "binary" },
      { name: "CHF", label: "Congestive Heart Failure", kind: "binary" },
      { name: "DLP", label: "Dyslipidemia", kind: "binary" },
    ],
  },
  Vitals: {
    label: "Vitals & Physical Exam",
    fields: [
      { name: "BP", label: "Blood Pressure (systolic)", unit: "mmHg", kind: "continuous" },
      { name: "PR", label: "Pulse Rate", unit: "bpm", kind: "continuous" },
      { name: "Edema", label: "Peripheral Edema", kind: "binary" },
      { name: "Weak Peripheral Pulse", label: "Weak Peripheral Pulse", kind: "binary" },
      { name: "Lung rales", label: "Lung Rales", kind: "binary" },
      { name: "Systolic Murmur", label: "Systolic Murmur", kind: "binary" },
      { name: "Diastolic Murmur", label: "Diastolic Murmur", kind: "binary" },
    ],
  },
  Symptoms: {
    label: "Symptoms & Function",
    fields: [
      { name: "Dyspnea", label: "Dyspnea", kind: "binary" },
      { name: "Function Class", label: "NYHA Function Class (0–3)", kind: "ordinal" },
      { name: "LowTH Ang", label: "Low Threshold Angina", kind: "binary" },
    ],
  },
  ECG: {
    label: "Electrocardiogram (ECG)",
    fields: [
      { name: "Q Wave", label: "Q Wave", kind: "binary" },
      { name: "St Elevation", label: "ST Elevation", kind: "binary" },
      { name: "St Depression", label: "ST Depression", kind: "binary" },
      { name: "Tinversion", label: "T Inversion", kind: "binary" },
      { name: "LVH", label: "Left Ventricular Hypertrophy", kind: "binary" },
      { name: "Poor R Progression", label: "Poor R Wave Progression", kind: "binary" },
      { name: "BBB", label: "Bundle Branch Block", kind: "categorical", options: ["N", "LBBB", "RBBB"] },
    ],
  },
  Labs: {
    label: "Laboratory Tests",
    fields: [
      { name: "FBS", label: "Fasting Blood Sugar", unit: "mg/dL", kind: "continuous" },
      { name: "CR", label: "Serum Creatinine", unit: "mg/dL", kind: "continuous" },
      { name: "TG", label: "Triglycerides", unit: "mg/dL", kind: "continuous" },
      { name: "LDL", label: "LDL Cholesterol", unit: "mg/dL", kind: "continuous" },
      { name: "HDL", label: "HDL Cholesterol", unit: "mg/dL", kind: "continuous" },
      { name: "BUN", label: "Blood Urea Nitrogen", unit: "mg/dL", kind: "continuous" },
      { name: "ESR", label: "Erythrocyte Sedimentation Rate", unit: "mm/hr", kind: "continuous" },
      { name: "HB", label: "Hemoglobin", unit: "g/dL", kind: "continuous" },
      { name: "K", label: "Potassium", unit: "mEq/L", kind: "continuous" },
      { name: "Na", label: "Sodium", unit: "mEq/L", kind: "continuous" },
      { name: "WBC", label: "White Blood Cells", unit: "cells/µL", kind: "continuous" },
      { name: "Lymph", label: "Lymphocytes", unit: "%", kind: "continuous" },
      { name: "Neut", label: "Neutrophils", unit: "%", kind: "continuous" },
      { name: "PLT", label: "Platelets", unit: "10³/µL", kind: "continuous" },
    ],
  },
  Echo: {
    label: "Echocardiography",
    fields: [
      { name: "EF-TTE", label: "Ejection Fraction (EF-TTE)", unit: "%", kind: "continuous" },
      { name: "Region RWMA", label: "Regional Wall Motion (0–4)", kind: "ordinal" },
      { name: "VHD", label: "Valvular Heart Disease", kind: "categorical", options: ["N", "mild", "moderate", "severe"] },
    ],
  },
};

export interface ClinicalInputs {
  mode: "quick" | "full";
  // 7 Quick mode primary fields:
  Age: string;
  Sex: string;
  chestPain: "None" | "Typical" | "Atypical" | "Non-anginal" | "";
  DM: "Yes" | "No" | "";
  HTN: "Yes" | "No" | "";
  // Optional Full mode features:
  [key: string]: string;
}

export type InputErrors = Record<string, string>;

export const emptyInputs: ClinicalInputs = {
  mode: "quick",
  Age: "",
  Sex: "",
  chestPain: "",
  DM: "",
  HTN: "",
};

export const exampleInputs: ClinicalInputs = {
  mode: "quick",
  Age: "58",
  Sex: "Male",
  chestPain: "Typical",
  DM: "No",
  HTN: "Yes",
};

export const exampleFullInputs: ClinicalInputs = {
  mode: "full",
  Age: "58",
  Sex: "Male",
  chestPain: "Typical",
  DM: "No",
  HTN: "Yes",
  BP: "130",
  PR: "70",
  FBS: "94",
  CR: "0.8",
  TG: "150",
  LDL: "110",
  HDL: "45",
  BUN: "14",
  HB: "14.2",
  "EF-TTE": "55",
};

/**
 * Validate form inputs using real physiological HARD_FEATURE_RANGES and backend rules.
 */
export function validateClinicalInputs(input: ClinicalInputs): InputErrors {
  const errors: InputErrors = {};

  // 1. Age (required in both modes)
  const ageStr = (input.Age || "").trim();
  if (!ageStr) {
    errors.Age = "Age is required.";
  } else {
    const ageVal = Number(ageStr);
    const [minAge, maxAge] = HARD_FEATURE_RANGES.Age;
    if (!Number.isFinite(ageVal) || ageVal < minAge || ageVal > maxAge || !/^\d+$/.test(ageStr)) {
      errors.Age = `Enter a whole number between ${minAge} and ${maxAge}.`;
    }
  }

  // 2. Sex (required in both modes)
  if (!input.Sex || !["Male", "Female"].includes(input.Sex)) {
    errors.Sex = "Select Male or Female.";
  }

  // 3. Chest Pain (required in both modes)
  if (!input.chestPain || !["None", "Typical", "Atypical", "Non-anginal"].includes(input.chestPain)) {
    errors.chestPain = "Select a chest pain classification.";
  }

  // 4. Diabetes (DM) (required in both modes)
  if (!input.DM || !["Yes", "No"].includes(input.DM)) {
    errors.DM = "Select Yes or No for diabetes.";
  }

  // 5. Hypertension (HTN) (required in both modes)
  if (!input.HTN || !["Yes", "No"].includes(input.HTN)) {
    errors.HTN = "Select Yes or No for hypertension.";
  }

  // 6. Optional Full-mode fields (only validated if non-empty)
  for (const [key, val] of Object.entries(input)) {
    if (["mode", "Age", "Sex", "chestPain", "DM", "HTN"].includes(key)) continue;
    const trimmed = (val || "").trim();
    if (!trimmed) continue; // blank = missing, allowed!

    // Numeric continuous / ordinal bounds
    if (key in HARD_FEATURE_RANGES) {
      const num = Number(trimmed);
      const [min, max] = HARD_FEATURE_RANGES[key];
      if (!Number.isFinite(num) || isNaN(num) || num < min || num > max) {
        errors[key] = `Value must be between ${min} and ${max}.`;
      }
    } else if (key === "BBB") {
      if (!["N", "LBBB", "RBBB"].includes(trimmed)) {
        errors.BBB = "Expected 'N', 'LBBB', or 'RBBB'.";
      }
    } else if (key === "VHD") {
      if (!["N", "mild", "moderate", "severe"].includes(trimmed.toLowerCase())) {
        errors.VHD = "Expected 'N', 'mild', 'moderate', or 'severe'.";
      }
    } else if (BINARY_FEATURES.has(key)) {
      if (!["Yes", "No", "true", "false"].includes(trimmed)) {
        errors[key] = "Select Yes or No.";
      }
    }
  }

  return errors;
}

/**
 * Prepares the payload for POST /api/predict according to backend contract.
 * Blank fields are omitted (never sent as 0).
 */
export function preparePredictPayload(input: ClinicalInputs): {
  mode: "quick" | "full";
  inputs: Record<string, unknown>;
  case_id: null;
} {
  const backendInputs: Record<string, unknown> = {
    Age: Number(input.Age),
    Sex: input.Sex,
    "Typical Chest Pain": input.chestPain === "Typical",
    Atypical: input.chestPain === "Atypical",
    Nonanginal: input.chestPain === "Non-anginal",
    DM: input.DM === "Yes",
    HTN: input.HTN === "Yes",
  };

  if (input.mode === "full") {
    for (const [key, val] of Object.entries(input)) {
      if (["mode", "Age", "Sex", "chestPain", "DM", "HTN"].includes(key)) continue;
      const trimmed = (val || "").trim();
      if (!trimmed) continue; // Omit blank fields!

      if (key in HARD_FEATURE_RANGES) {
        backendInputs[key] = Number(trimmed);
      } else if (key === "BBB") {
        backendInputs.BBB = trimmed;
      } else if (key === "VHD") {
        backendInputs.VHD = trimmed;
      } else if (BINARY_FEATURES.has(key)) {
        backendInputs[key] = trimmed === "Yes" || trimmed === "true";
      }
    }
  }

  return {
    mode: input.mode,
    inputs: backendInputs,
    case_id: null,
  };
}

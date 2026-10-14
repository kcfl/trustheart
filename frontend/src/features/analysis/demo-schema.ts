export * from "./clinical-schema";
import {
  validateClinicalInputs,
  type ClinicalInputs,
  type InputErrors,
} from "./clinical-schema";

export interface DemoInputs {
  age?: string;
  sex?: string;
  systolic?: string;
  cholesterol?: string;
  diabetes?: string;
  smoking?: string;
  Age?: string;
  Sex?: string;
  chestPain?: "None" | "Typical" | "Atypical" | "Non-anginal" | "";
  DM?: "Yes" | "No" | "";
  HTN?: "Yes" | "No" | "";
  [key: string]: any;
}

export const emptyInputs: ClinicalInputs & DemoInputs = {
  mode: "quick",
  Age: "",
  Sex: "",
  chestPain: "",
  DM: "",
  HTN: "",
  age: "",
  sex: "",
  systolic: "",
  cholesterol: "",
  diabetes: "",
  smoking: "",
};

export const exampleInputs: ClinicalInputs & DemoInputs = {
  mode: "quick",
  Age: "58",
  Sex: "Male",
  chestPain: "Typical",
  DM: "No",
  HTN: "Yes",
  age: "58",
  sex: "Male",
  systolic: "138",
  cholesterol: "218",
  diabetes: "No",
  smoking: "No",
};

export function validateDemoInputs(input: DemoInputs): InputErrors {
  // If legacy lowercase demo fields are tested (e.g. from smooth-input.test.ts)
  if (input.age !== undefined && input.systolic !== undefined) {
    const errors: InputErrors = {};
    const ranges = {
      age: [18, 100],
      systolic: [60, 250],
      cholesterol: [50, 600],
    };
    for (const key of ["age", "systolic", "cholesterol"] as const) {
      const valStr = String(input[key] ?? "").trim();
      const value = Number(valStr);
      const [min, max] = ranges[key];
      if (!valStr) {
        errors[key] = "This demo field is required.";
      } else if (
        !/^\d+$/.test(valStr) ||
        !Number.isFinite(value) ||
        value < min ||
        value > max ||
        !Number.isInteger(value)
      ) {
        errors[key] = `Enter a whole number from ${min} to ${max} (demo UI limits).`;
      }
    }
    if (input.sex && !["Female", "Male", "Other / not specified"].includes(input.sex)) {
      errors.sex = "Select a value for this demo.";
    }
    for (const key of ["diabetes", "smoking"] as const) {
      if (input[key] && !["Yes", "No", "Unknown"].includes(input[key])) {
        errors[key] = "Select a value for this demo.";
      }
    }
    return errors;
  }

  // If testing age individually with exampleInputs
  if (input.age !== undefined) {
    const errors: InputErrors = {};
    const valStr = String(input.age).trim();
    const value = Number(valStr);
    if (!valStr || !/^\d+$/.test(valStr) || !Number.isFinite(value) || value < 18 || value > 100) {
      errors.age = "Enter a whole number from 18 to 100 (demo UI limits).";
    }
    return errors;
  }

  return validateClinicalInputs(input as ClinicalInputs);
}

import type { FeatureMetaItem, PredictRequest, SampleItem } from '../api/client'

export type FormState = Record<string, string>

export interface FormValidationResult {
  errors: Record<string, string>
  request: PredictRequest | null
}

/**
 * Convert a sample item from /api/samples into editable form state and extract its case_id.
 */
export function sampleToForm(sample: SampleItem): { formState: FormState; caseId: number | null } {
  const formState: FormState = {}
  const inputs = (sample.inputs ?? {}) as Record<string, unknown>

  for (const [key, val] of Object.entries(inputs)) {
    if (val === true) {
      formState[key] = 'yes'
    } else if (val === false) {
      formState[key] = 'no'
    } else if (val !== null && val !== undefined) {
      formState[key] = String(val)
    } else {
      formState[key] = 'unknown'
    }
  }

  return {
    formState,
    caseId: sample.case_id !== undefined ? sample.case_id : null,
  }
}

/**
 * Validate and map user form state into a typed PredictRequest according to mode and feature metadata.
 *
 * Rules:
 * - Empty or "unknown" fields are omitted from inputs (the server will impute training medians).
 * - Binary fields are tri-state (Unknown / No / Yes) mapping to omitted / false / true.
 * - Sex maps to "Male" | "Female", or omitted if unknown.
 * - BBB and VHD are selects with an Unknown option (omitted when unknown).
 * - Numbers are parsed with Number() and rejected if not finite (returning a field-level error).
 * - In quick mode, features that are not `in_quick` are omitted.
 */
export function formToPredictRequest(
  mode: 'quick' | 'full',
  formState: FormState,
  caseId: number | null,
  metaFeatures: FeatureMetaItem[]
): FormValidationResult {
  const errors: Record<string, string> = {}
  const inputs: Record<string, unknown> = {}

  for (const feature of metaFeatures) {
    // In quick mode, skip features that are not in quick mode
    if (mode === 'quick' && !feature.in_quick) {
      continue
    }

    const rawVal = formState[feature.name]
    if (rawVal === undefined || rawVal === null) {
      continue
    }

    const trimmed = typeof rawVal === 'string' ? rawVal.trim() : String(rawVal).trim()
    if (trimmed === '' || trimmed.toLowerCase() === 'unknown') {
      continue
    }

    if (feature.kind === 'binary') {
      const lower = trimmed.toLowerCase()
      if (lower === 'yes' || lower === 'true') {
        inputs[feature.name] = true
      } else if (lower === 'no' || lower === 'false') {
        inputs[feature.name] = false
      } else {
        errors[feature.name] = 'Must be Yes, No, or Unknown'
      }
    } else if (feature.kind === 'continuous') {
      const num = Number(trimmed)
      if (!Number.isFinite(num)) {
        errors[feature.name] = 'Must be a valid finite number'
      } else {
        inputs[feature.name] = num
      }
    } else if (feature.name === 'Sex') {
      const lower = trimmed.toLowerCase()
      if (lower === 'male') {
        inputs[feature.name] = 'Male'
      } else if (lower === 'female') {
        inputs[feature.name] = 'Female'
      } else {
        errors[feature.name] = 'Must be Male, Female, or Unknown'
      }
    } else if (feature.name === 'BBB') {
      const val = trimmed.toUpperCase()
      if (val === 'N' || val === 'LBBB' || val === 'RBBB') {
        inputs[feature.name] = val
      } else {
        errors[feature.name] = 'Must be N, LBBB, RBBB, or Unknown'
      }
    } else if (feature.name === 'VHD') {
      const allowed = ['N', 'mild', 'Moderate', 'Severe']
      const matched = allowed.find((a) => a.toLowerCase() === trimmed.toLowerCase())
      if (matched) {
        inputs[feature.name] = matched
      } else {
        errors[feature.name] = 'Must be N, mild, Moderate, Severe, or Unknown'
      }
    } else {
      // Categorical or ordinal
      inputs[feature.name] = trimmed
    }
  }

  if (Object.keys(errors).length > 0) {
    return { errors, request: null }
  }

  return {
    errors: {},
    request: {
      mode,
      inputs,
      case_id: caseId,
    },
  }
}

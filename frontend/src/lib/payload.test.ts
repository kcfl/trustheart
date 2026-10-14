import { describe, expect, it } from 'vitest'
import type { FeatureMetaItem, SampleItem } from '../api/client'
import { formToPredictRequest, sampleToForm } from './payload'

const mockFeatures: FeatureMetaItem[] = [
  {
    name: 'Age',
    label: 'Age',
    kind: 'continuous',
    group: 'Demographics',
    in_quick: true,
    training: { min: 30, max: 86, median: 58 },
    training_min: 30,
    training_max: 86,
    training_median: 58,
  },
  {
    name: 'Sex',
    label: 'Sex',
    kind: 'categorical',
    group: 'Demographics',
    in_quick: true,
    training: { min: 0, max: 1, median: 1 },
    training_min: 0,
    training_max: 1,
    training_median: 1,
  },
  {
    name: 'DM',
    label: 'Diabetes Mellitus',
    kind: 'binary',
    group: 'History',
    in_quick: true,
    training: { min: 0, max: 1, median: 0 },
    training_min: 0,
    training_max: 1,
    training_median: 0,
  },
  {
    name: 'BBB',
    label: 'BBB',
    kind: 'categorical',
    group: 'ECG',
    in_quick: false,
    training: { min: 0, max: 2, median: 0 },
    training_min: 0,
    training_max: 2,
    training_median: 0,
  },
  {
    name: 'VHD',
    label: 'VHD',
    kind: 'ordinal',
    group: 'Echo',
    in_quick: false,
    training: { min: 0, max: 3, median: 0 },
    training_min: 0,
    training_max: 3,
    training_median: 0,
  },
  {
    name: 'Weight',
    label: 'Weight',
    kind: 'continuous',
    group: 'Demographics',
    in_quick: false,
    training: { min: 48, max: 120, median: 73 },
    training_min: 48,
    training_max: 120,
    training_median: 73,
  },
]

describe('payload.ts formToPredictRequest and sampleToForm', () => {
  it('handles tri-state binary mapping: yes -> true, no -> false, unknown/empty -> omitted', () => {
    // 1. yes
    const resYes = formToPredictRequest('quick', { DM: 'yes' }, null, mockFeatures)
    expect(resYes.errors).toEqual({})
    expect(resYes.request?.inputs['DM']).toBe(true)

    // 2. no
    const resNo = formToPredictRequest('quick', { DM: 'no' }, null, mockFeatures)
    expect(resNo.errors).toEqual({})
    expect(resNo.request?.inputs['DM']).toBe(false)

    // 3. unknown or empty -> omitted
    const resUnknown = formToPredictRequest('quick', { DM: 'unknown' }, null, mockFeatures)
    expect(resUnknown.errors).toEqual({})
    expect(resUnknown.request?.inputs).not.toHaveProperty('DM')

    const resEmpty = formToPredictRequest('quick', { DM: '' }, null, mockFeatures)
    expect(resEmpty.errors).toEqual({})
    expect(resEmpty.request?.inputs).not.toHaveProperty('DM')
  })

  it('handles Sex mapping: Male -> Male, Female -> Female, unknown -> omitted', () => {
    const resMale = formToPredictRequest('quick', { Sex: 'Male' }, null, mockFeatures)
    expect(resMale.request?.inputs['Sex']).toBe('Male')

    const resFemale = formToPredictRequest('quick', { Sex: 'Female' }, null, mockFeatures)
    expect(resFemale.request?.inputs['Sex']).toBe('Female')

    const resUnknown = formToPredictRequest('quick', { Sex: 'unknown' }, null, mockFeatures)
    expect(resUnknown.request?.inputs).not.toHaveProperty('Sex')
  })

  it('rejects NaN / non-finite numbers and returns field-level error without throwing', () => {
    const resNaN = formToPredictRequest('quick', { Age: 'not_a_number' }, null, mockFeatures)
    expect(resNaN.request).toBeNull()
    expect(resNaN.errors['Age']).toBe('Must be a valid finite number')

    const resInfinity = formToPredictRequest('quick', { Age: 'Infinity' }, null, mockFeatures)
    expect(resInfinity.request).toBeNull()
    expect(resInfinity.errors['Age']).toBe('Must be a valid finite number')

    const resValid = formToPredictRequest('quick', { Age: '58.5' }, null, mockFeatures)
    expect(resValid.errors).toEqual({})
    expect(resValid.request?.inputs['Age']).toBe(58.5)
  })

  it('enforces quick vs full feature omission', () => {
    const fullForm = {
      Age: '60',
      Sex: 'Male',
      DM: 'yes',
      Weight: '75', // in_quick === false
      BBB: 'LBBB',  // in_quick === false
    }

    // In quick mode, Weight and BBB must be omitted
    const quickRes = formToPredictRequest('quick', fullForm, null, mockFeatures)
    expect(quickRes.errors).toEqual({})
    expect(quickRes.request?.inputs).toEqual({
      Age: 60,
      Sex: 'Male',
      DM: true,
    })
    expect(quickRes.request?.inputs).not.toHaveProperty('Weight')
    expect(quickRes.request?.inputs).not.toHaveProperty('BBB')

    // In full mode, all valid fields are included
    const fullRes = formToPredictRequest('full', fullForm, 125, mockFeatures)
    expect(fullRes.errors).toEqual({})
    expect(fullRes.request?.inputs).toEqual({
      Age: 60,
      Sex: 'Male',
      DM: true,
      Weight: 75,
      BBB: 'LBBB',
    })
    expect(fullRes.request?.case_id).toBe(125)
  })

  it('sampleToForm correctly populates form state and extracts case_id', () => {
    const sample: SampleItem = {
      case_id: 293,
      label: 'p10',
      label_text: '10th percentile CAD risk',
      inputs: {
        Age: 59,
        Sex: 'Male',
        DM: false,
        HTN: true,
        BBB: 'N',
        VHD: 'mild',
      },
      ground_truth: { CAD: 0, LAD: 0, LCX: 0, RCA: 0 },
      ground_truth_note: 'test ground truth',
      oof_estimate: { CAD: 0.1, LAD: 0.1, LCX: 0.1, RCA: 0.1 },
      oof_estimate_note: 'test oof estimate',
    }

    const { formState, caseId } = sampleToForm(sample)
    expect(caseId).toBe(293)
    expect(formState['Age']).toBe('59')
    expect(formState['Sex']).toBe('Male')
    expect(formState['DM']).toBe('no')
    expect(formState['HTN']).toBe('yes')
    expect(formState['BBB']).toBe('N')
    expect(formState['VHD']).toBe('mild')
  })
})

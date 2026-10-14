import React, { useEffect, useState } from 'react'
import {
  type FeatureMetaItem,
  type HealthResponse,
  type PredictResponse,
  type SampleItem,
  getHealth,
  getMeta,
  getSamples,
  predict,
} from './api/client'
import { DisclaimerBanner } from './components/DisclaimerBanner'
import { Header } from './components/Header'
import { ModeToggle } from './components/ModeToggle'
import { PatientForm } from './components/PatientForm'
import { ResultsPanel } from './components/ResultsPanel'
import { SamplePicker } from './components/SamplePicker'
import { type FormState, formToPredictRequest, sampleToForm } from './lib/payload'

export function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [metaFeatures, setMetaFeatures] = useState<FeatureMetaItem[]>([])
  const [samples, setSamples] = useState<SampleItem[]>([])
  const [loadingInitial, setLoadingInitial] = useState<boolean>(true)
  const [initError, setInitError] = useState<string | null>(null)

  const [mode, setMode] = useState<'quick' | 'full'>('quick')
  const [formState, setFormState] = useState<FormState>({})
  const [caseId, setCaseId] = useState<number | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const [predictLoading, setPredictLoading] = useState<boolean>(false)
  const [predictResult, setPredictResult] = useState<PredictResponse | null>(null)
  const [predictError, setPredictError] = useState<string | null>(null)

  // Fetch initial API metadata and health
  useEffect(() => {
    const abortController = new AbortController()

    async function fetchInitialData() {
      try {
        setLoadingInitial(true)
        const [healthData, metaData, samplesData] = await Promise.all([
          getHealth(abortController.signal),
          getMeta(abortController.signal),
          getSamples(abortController.signal),
        ])

        setHealth(healthData)
        setMetaFeatures(metaData.features || [])
        setSamples(samplesData.samples || [])
        setInitError(null)
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        const msg = err instanceof Error ? err.message : String(err)
        setInitError(msg)
      } finally {
        setLoadingInitial(false)
      }
    }

    fetchInitialData()

    return () => {
      abortController.abort()
    }
  }, [])

  const handleModeChange = (newMode: 'quick' | 'full') => {
    setMode(newMode)
    setFieldErrors({})
  }

  const handleSelectSample = (sample: SampleItem) => {
    const { formState: newFormState, caseId: newCaseId } = sampleToForm(sample)
    setFormState(newFormState)
    setCaseId(newCaseId)
    setFieldErrors({})
    setPredictError(null)
  }

  const handleClear = () => {
    setFormState({})
    setCaseId(null)
    setFieldErrors({})
    setPredictResult(null)
    setPredictError(null)
  }

  const handleChangeField = (featureName: string, value: string) => {
    setFormState((prev) => ({
      ...prev,
      [featureName]: value,
    }))
    if (fieldErrors[featureName]) {
      setFieldErrors((prev) => {
        const next = { ...prev }
        delete next[featureName]
        return next
      })
    }
  }

  const handlePredict = async (e: React.FormEvent) => {
    e.preventDefault()
    setPredictError(null)

    const validation = formToPredictRequest(mode, formState, caseId, metaFeatures)
    if (validation.errors && Object.keys(validation.errors).length > 0) {
      setFieldErrors(validation.errors)
      return
    }

    if (!validation.request) {
      return
    }

    try {
      setPredictLoading(true)
      const res = await predict(validation.request)
      setPredictResult(res)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setPredictError(msg)
      setPredictResult(null)
    } finally {
      setPredictLoading(false)
    }
  }

  return (
    <div className="app-layout">
      {/* Sticky non-dismissible clinical disclaimer */}
      <DisclaimerBanner disclaimer={health?.disclaimer} />

      <Header modelVersion={health?.model_version} loading={loadingInitial} />

      {initError && (
        <div className="init-error-bar" role="alert">
          <strong>Initialization Notice:</strong> {initError} (Using local fallback settings)
        </div>
      )}

      <main className="main-content">
        <div className="layout-grid">
          {/* Left / Input column */}
          <div className="input-column">
            <ModeToggle mode={mode} onChange={handleModeChange} disabled={predictLoading} />

            <SamplePicker
              samples={samples}
              selectedCaseId={caseId}
              onSelectSample={handleSelectSample}
              onClear={handleClear}
              disabled={predictLoading}
            />

            <PatientForm
              mode={mode}
              metaFeatures={metaFeatures}
              formState={formState}
              fieldErrors={fieldErrors}
              onChangeField={handleChangeField}
              onSubmit={handlePredict}
              loading={predictLoading}
            />
          </div>

          {/* Right / Results column */}
          <div className="results-column">
            <ResultsPanel result={predictResult} error={predictError} />
          </div>
        </div>
      </main>
    </div>
  )
}

export default App

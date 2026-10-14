import type { components } from './schema'

export type HealthResponse = components['schemas']['HealthResponse']
export type MetaResponse = components['schemas']['MetaResponse']
export type MetadataResponse = MetaResponse
export type SamplesResponse = components['schemas']['SamplesResponse']
export type SamplePatient = components['schemas']['SamplePatient']
export type SampleItem = SamplePatient
export type PredictRequest = components['schemas']['PredictRequest']
export type PredictResponse = components['schemas']['PredictResponse']
export type TargetPrediction = components['schemas']['TargetPrediction']
export type FeatureMetaItem = components['schemas']['FeatureMetaItem']

export class ApiError extends Error {
  status?: number
  retryAfter?: string | null
  detail?: unknown

  constructor(message: string, status?: number, detail?: unknown, retryAfter?: string | null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
    this.retryAfter = retryAfter
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.ok) {
    return (await res.json()) as T
  }

  const status = res.status
  let detail: unknown = null
  try {
    const errorJson = await res.json()
    detail = errorJson.detail ?? errorJson
  } catch {
    // Non-JSON response body
  }

  if (status === 413) {
    throw new ApiError(
      'Request payload is too large (maximum size is 20 KB). Please reduce input payload.',
      status,
      detail
    )
  }

  if (status === 422) {
    const detailMsg =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: { msg?: string; loc?: string[] }) => d.msg || JSON.stringify(d)).join('; ')
          : JSON.stringify(detail)
    throw new ApiError(
      `Validation error (422): ${detailMsg || 'Invalid request parameters'}`,
      status,
      detail
    )
  }

  if (status === 429) {
    const retryAfter = res.headers.get('Retry-After')
    const waitMsg = retryAfter ? ` Please retry after ${retryAfter} second(s).` : ' Please slow down.'
    throw new ApiError(
      `Rate limit exceeded (429).${waitMsg}`,
      status,
      detail,
      retryAfter
    )
  }

  throw new ApiError(
    `API request failed with status ${status}: ${typeof detail === 'string' ? detail : res.statusText || 'Unknown error'}`,
    status,
    detail
  )
}

function catchNetworkError(err: unknown): never {
  if (err instanceof ApiError) {
    throw err
  }
  if (err instanceof DOMException && err.name === 'AbortError') {
    throw err
  }
  const msg = err instanceof Error ? err.message : String(err)
  throw new ApiError(`Network error: Unable to connect to the TrustHeart API server (${msg}).`)
}

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  try {
    const res = await fetch('/api/health', {
      method: 'GET',
      credentials: 'omit',
      signal,
    })
    return await handleResponse<HealthResponse>(res)
  } catch (err) {
    return catchNetworkError(err)
  }
}

export async function getMeta(signal?: AbortSignal): Promise<MetadataResponse> {
  try {
    const res = await fetch('/api/meta', {
      method: 'GET',
      credentials: 'omit',
      signal,
    })
    return await handleResponse<MetadataResponse>(res)
  } catch (err) {
    return catchNetworkError(err)
  }
}

export async function getSamples(signal?: AbortSignal): Promise<SamplesResponse> {
  try {
    const res = await fetch('/api/samples', {
      method: 'GET',
      credentials: 'omit',
      signal,
    })
    return await handleResponse<SamplesResponse>(res)
  } catch (err) {
    return catchNetworkError(err)
  }
}

export async function predict(
  request: PredictRequest,
  signal?: AbortSignal
): Promise<PredictResponse> {
  try {
    const res = await fetch('/api/predict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      credentials: 'omit',
      signal,
    })
    return await handleResponse<PredictResponse>(res)
  } catch (err) {
    return catchNetworkError(err)
  }
}

/**
 * Detect WebGL availability in the current browser/runtime.
 * Safe for SSR and jsdom test environments.
 */
export function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false
  }

  // Avoid jsdom "not implemented" console error in node test environments
  if (
    typeof navigator !== 'undefined' &&
    (navigator.userAgent?.includes('jsdom') || navigator.userAgent?.includes('Node.js'))
  ) {
    return false
  }

  try {
    const canvas = document.createElement('canvas')
    const gl =
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    return Boolean(gl && gl instanceof WebGLRenderingContext)
  } catch {
    return false
  }
}

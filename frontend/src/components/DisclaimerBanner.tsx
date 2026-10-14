interface DisclaimerBannerProps {
  disclaimer?: string | null
}

const FALLBACK_DISCLAIMER =
  'Decision support / educational use only. Predictions are per-vessel probabilities from a small single-centre dataset and are not a lesion location. Not a substitute for formal diagnostic imaging or clinical judgement.'

export function DisclaimerBanner({ disclaimer }: DisclaimerBannerProps) {
  const text = disclaimer && disclaimer.trim().length > 0 ? disclaimer : FALLBACK_DISCLAIMER

  return (
    <aside
      className="disclaimer-banner"
      role="alert"
      aria-live="polite"
      aria-label="Clinical Decision Support Disclaimer"
    >
      <div className="disclaimer-content">
        <span className="disclaimer-badge">CLINICAL NOTICE</span>
        <p className="disclaimer-text">{text}</p>
      </div>
    </aside>
  )
}

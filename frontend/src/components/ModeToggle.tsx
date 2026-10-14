interface ModeToggleProps {
  mode: 'quick' | 'full'
  onChange: (mode: 'quick' | 'full') => void
  disabled?: boolean
}

export function ModeToggle({ mode, onChange, disabled }: ModeToggleProps) {
  return (
    <section className="mode-toggle-section" aria-label="Assessment Mode Selection">
      <div className="mode-toggle-buttons" role="radiogroup" aria-label="Mode selection">
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'quick'}
          className={`mode-btn ${mode === 'quick' ? 'active' : ''}`}
          onClick={() => onChange('quick')}
          disabled={disabled}
        >
          Quick Mode (7 inputs)
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === 'full'}
          className={`mode-btn ${mode === 'full' ? 'active' : ''}`}
          onClick={() => onChange('full')}
          disabled={disabled}
        >
          Full Mode (54 inputs)
        </button>
      </div>
      <p className="mode-description">
        {mode === 'quick'
          ? 'Fast bedside screening using 7 core clinical symptoms and history.'
          : 'Comprehensive clinical evaluation using all 54 demographic, physical exam, ECG, echo, and lab features.'}
      </p>
    </section>
  )
}

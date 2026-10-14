interface HeaderProps {
  modelVersion?: string | null
  loading?: boolean
}

export function Header({ modelVersion, loading }: HeaderProps) {
  return (
    <header className="app-header">
      <div className="header-inner">
        <div className="header-title-row">
          <h1 className="header-title">TrustHeart 3D</h1>
          <span className="header-tag">Clinical Risk Assessment</span>
        </div>
        <div className="header-meta">
          <span className="model-badge">
            Model: {modelVersion || (loading ? 'Connecting to API...' : 'ml-v1')}
          </span>
        </div>
      </div>
    </header>
  )
}

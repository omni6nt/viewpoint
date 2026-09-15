import { useState, useEffect } from 'react'
import {
  fetchLiveNetworkData,
  fetchUtilizationForEpoch,
  fetchEmissionsForEpoch,
  fetchWalletRewardData,
  resolveNameOrAddress,
  projectNewLock,
  MAXTIME_SECONDS,
} from './intuition'
import { AnimatedNumber } from './AnimatedNumber'
import { ProgressRing } from './ProgressRing'
import './App.css'

const LOCK_OPTIONS = [
  { label: 'No lock', seconds: 0 },
  { label: '3 months', seconds: 90 * 86400 },
  { label: '6 months', seconds: 180 * 86400 },
  { label: '1 year', seconds: 365 * 86400 },
  { label: '2 years (max)', seconds: MAXTIME_SECONDS },
]

const RECENT_WALLETS_KEY = 'trust-apy-recent-wallets'
const MAX_RECENT_WALLETS = 5

function loadRecentWallets() {
  try {
    const raw = window.localStorage.getItem(RECENT_WALLETS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveRecentWallet(rawInput) {
  try {
    const current = loadRecentWallets()
    const withoutDupe = current.filter((a) => a.toLowerCase() !== rawInput.toLowerCase())
    const updated = [rawInput, ...withoutDupe].slice(0, MAX_RECENT_WALLETS)
    window.localStorage.setItem(RECENT_WALLETS_KEY, JSON.stringify(updated))
    return updated
  } catch {
    return loadRecentWallets()
  }
}

function InfoTip({ text }) {
  return (
    <span className="info-tip-wrapper" tabIndex={0}>
      <span className="info-tip-icon" aria-label="More info">i</span>
      <span className="info-tip-bubble">{text}</span>
    </span>
  )
}

function formatCountdown(msRemaining) {
  if (msRemaining <= 0) return 'Epoch ended'
  const totalSeconds = Math.floor(msRemaining / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${days}d ${hours}h ${minutes}m ${seconds}s`
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function shortenAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatCompactNumber(value) {
  if (value === null || value === undefined) return '—'
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)} K`
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

function formatTrust(value) {
  return `${formatCompactNumber(value)} TRUST`
}

function App() {
  const [amount, setAmount] = useState(1000)
  const [personalUtilization, setPersonalUtilization] = useState(100)
  const [selectedLockSeconds, setSelectedLockSeconds] = useState(365 * 86400)
  const [showLockDropdown, setShowLockDropdown] = useState(false)

  const [liveData, setLiveData] = useState(null)
  const [loadingLiveData, setLoadingLiveData] = useState(true)
  const [liveDataError, setLiveDataError] = useState(false)

  const [selectedEpoch, setSelectedEpoch] = useState(null)
  const [epochUtilization, setEpochUtilization] = useState(null)
  const [epochEmissions, setEpochEmissions] = useState(null)
  const [loadingEpoch, setLoadingEpoch] = useState(false)

  const [walletInput, setWalletInput] = useState('')
  const [resolvedAddress, setResolvedAddress] = useState(null)
  const [walletData, setWalletData] = useState(null)
  const [loadingWallet, setLoadingWallet] = useState(false)
  const [walletError, setWalletError] = useState(null)
  const [recentWallets, setRecentWallets] = useState([])
  const [showWalletDropdown, setShowWalletDropdown] = useState(false)

  const [now, setNow] = useState(Date.now())
  const [activeSection, setActiveSection] = useState('dashboard')

  useEffect(() => {
    fetchLiveNetworkData()
      .then((data) => {
        setLiveData(data)
        setSelectedEpoch(data.utilizationEpochUsed)
        setLoadingLiveData(false)
      })
      .catch((err) => {
        console.error('Live data fetch failed:', err)
        setLiveDataError(true)
        setLoadingLiveData(false)
      })
    setRecentWallets(loadRecentWallets())
  }, [])

  useEffect(() => {
    if (selectedEpoch === null) return
    setLoadingEpoch(true)
    Promise.all([fetchUtilizationForEpoch(selectedEpoch), fetchEmissionsForEpoch(selectedEpoch)])
      .then(([pct, emissions]) => {
        setEpochUtilization(pct)
        setEpochEmissions(emissions)
        setLoadingEpoch(false)
      })
      .catch((err) => {
        console.error('Epoch data fetch failed:', err)
        setEpochUtilization(null)
        setEpochEmissions(null)
        setLoadingEpoch(false)
      })
  }, [selectedEpoch])

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const sections = ['dashboard', 'calculator', 'wallet', 'analytics']
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 180
      let current = 'dashboard'
      for (const id of sections) {
        const element = document.getElementById(id)
        if (element && element.offsetTop <= scrollPosition) current = id
      }
      setActiveSection(current)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  function handleCheckWallet(entryOverride) {
    const rawInput = (entryOverride ?? walletInput).trim()
    setWalletError(null)
    setWalletData(null)
    setShowWalletDropdown(false)
    if (!liveData) return
    if (!rawInput) {
      setWalletError('Enter a wallet address, ENS name, or TNS name.')
      return
    }

    setWalletInput(rawInput)
    setLoadingWallet(true)

    resolveNameOrAddress(rawInput)
      .then(({ address }) => {
        setResolvedAddress(address)
        return fetchWalletRewardData(address, liveData.currentEpoch)
      })
      .then((data) => {
        setWalletData(data)
        setPersonalUtilization(Math.min(100, Math.max(0, data.personalUtilizationPercent)))
        setLoadingWallet(false)
        setRecentWallets(saveRecentWallet(rawInput))
      })
      .catch((err) => {
        console.error('Wallet lookup failed:', err)
        setWalletError(err.message || 'Could not resolve or fetch that wallet.')
        setLoadingWallet(false)
      })
  }

  function handleClearWallet() {
    setWalletInput('')
    setWalletData(null)
    setWalletError(null)
    setResolvedAddress(null)
  }

  const personalUtilizationFraction = Math.max(personalUtilization / 100, 0.25)
  const countdownText = liveData ? formatCountdown(liveData.epochEndTimestamp - now) : null

  const filteredRecentWallets = walletInput.trim()
    ? recentWallets.filter((entry) => entry.toLowerCase().includes(walletInput.trim().toLowerCase()))
    : recentWallets

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
          </div>
          <div className="brand-copy">
            <strong>VIEWPOINT</strong>

          </div>
        </div>

        <nav className="sidebar-nav">
          <a href="#dashboard" className={`nav-item ${activeSection === 'dashboard' ? 'active' : ''}`}>
            <span className="nav-icon">⌂</span>
            <span>Dashboard</span>
          </a>
          <a href="#calculator" className={`nav-item ${activeSection === 'calculator' ? 'active' : ''}`}>
            <span className="nav-icon">⌘</span>
            <span>Calculator</span>
          </a>
          <a href="#wallet" className={`nav-item ${activeSection === 'wallet' ? 'active' : ''}`}>
            <span className="nav-icon">◉</span>
            <span>My Position</span>
          </a>
          <a href="#analytics" className={`nav-item ${activeSection === 'analytics' ? 'active' : ''}`}>
            <span className="nav-icon">⌁</span>
            <span>Analytics</span>
            <span className="nav-badge">Soon</span>
          </a>
        </nav>

        <div className="sidebar-bottom">
          <div className="network-status">
            <span className="status-dot"></span>
            <div>
              <strong>Intuition</strong>
              <span>Network live</span>
            </div>
          </div>
          <div className="chain-id">
            Chain ID <strong>1155</strong>
          </div>
        </div>
      </aside>

      <main className="dashboard" id="dashboard">
               <header className="intro-band">
          <div className="mobile-logo-row">
            <div className="mobile-logo-mark"></div>
            <h1 className="intro-title">VIEWPOINT</h1>
          </div>
                    
          <p className="intro-subtitle">$TRUST Bonding Intelligence</p>
          <div className="topbar-live">
            <span className="status-dot"></span>
            <span>Live on Intuition</span>
          </div>
          <p className="intro-page">Dashboard</p>
        </header>

        <section className="metric-grid">
          <div className="metric-card primary">
            <div className="metric-card-top">
              <span>Current APY</span>
              <span className="metric-icon">↗</span>
            </div>
            <div className="metric-main">
              {loadingLiveData ? (
                <span className="metric-loading">Loading...</span>
              ) : liveData ? (
                <AnimatedNumber value={liveData.currentApyPercent} decimals={1} suffix="%" />
              ) : (
                '—'
              )}
            </div>
            <div className="metric-foot">
              <span className="ember-dot"></span>Live protocol rate
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-card-top">
              <span>Current Epoch</span>
              <span className="metric-icon">#</span>
            </div>
            <div className="metric-main">
              {loadingLiveData ? (
                <span className="metric-loading">Loading...</span>
              ) : liveData ? (
                <AnimatedNumber value={liveData.currentEpoch} decimals={0} />
              ) : (
                '—'
              )}
            </div>
            <div className="metric-foot">Epoch {liveData?.currentEpoch ?? '—'} active</div>
          </div>

          <div className="metric-card">
            <div className="metric-card-top">
              <span>Total Bonded</span>
              <span className="metric-icon">◈</span>
            </div>
            <div className="metric-main metric-trust">
              {loadingLiveData ? (
                <span className="metric-loading">Loading...</span>
              ) : liveData ? (
                <span>{formatCompactNumber(liveData.totalBondedBalance)} TRUST</span>
              ) : (
                '—'
              )}
            </div>
            <div className="metric-foot">TRUST bonded across network</div>
          </div>

          <div className="metric-card">
            <div className="metric-card-top">
              <span>Next Epoch</span>
              <span className="metric-icon">◷</span>
            </div>
            <div className="metric-main countdown-main">
              {loadingLiveData ? <span className="metric-loading">Loading...</span> : countdownText ?? '—'}
            </div>
            <div className="metric-foot">
              <span className="ember-dot"></span>Countdown is live
            </div>
          </div>
        </section>

        <section className="dashboard-grid">
          <div className="dashboard-card network-card">
            <div className="card-header">
              <div>
                <span className="section-label">NETWORK</span>
                <h2>Network overview</h2>
              </div>
              <div className="epoch-pill">
                <span>
                  Epoch <InfoTip text="A fixed 14-day period. TrustBonding calculates and distributes rewards per epoch, not continuously." />
                </span>
                <strong>{selectedEpoch ?? '—'}</strong>
              </div>
            </div>

            {loadingLiveData && <div className="empty-state">Pulling live network data...</div>}
            {liveDataError && <div className="empty-state error">Could not reach the Intuition network.</div>}

            {liveData && !liveDataError && (
              <>
                <div className="network-overview">
                  <div className="ring-panel">
                    <ProgressRing percent={epochUtilization || 0} color="#ff6b35" size={132} strokeWidth={8} />
                    <div className="ring-center">
                      <strong>{epochUtilization !== null ? `${epochUtilization.toFixed(1)}%` : '—'}</strong>
                      <span>utilization</span>
                    </div>
                  </div>

                  <div className="network-details">
                    <div className="detail-block">
                      <span>Selected epoch</span>
                      <div className="epoch-controller">
                        <button onClick={() => setSelectedEpoch((e) => Math.max(0, e - 1))} disabled={selectedEpoch <= 0}>
                          ←
                        </button>
                        <strong>Epoch {selectedEpoch}</strong>
                        <button
                          onClick={() => setSelectedEpoch((e) => Math.min(liveData.currentEpoch, e + 1))}
                          disabled={selectedEpoch >= liveData.currentEpoch}
                        >
                          →
                        </button>
                      </div>
                      <span className={`epoch-status-tag ${selectedEpoch === liveData.currentEpoch ? 'live' : 'ended'}`}>
                        {selectedEpoch === liveData.currentEpoch ? 'Live' : 'Ended'}
                      </span>
                    </div>

                    <div className="detail-row">
                      <span>
                        System utilization <InfoTip text="How much of the network's expected activity happened this epoch. Low utilization scales down rewards for everyone." />
                      </span>
                      <strong className="ember-text">
                        {loadingEpoch ? '...' : epochUtilization !== null ? <AnimatedNumber value={epochUtilization} decimals={1} suffix="%" /> : 'N/A'}
                      </strong>
                    </div>

                    <div className="detail-row emissions-row">
                      <span>
                        Emissions (this epoch) <InfoTip text="The total TRUST released as rewards for this specific epoch." />
                      </span>
                      <strong>{loadingEpoch ? '...' : epochEmissions !== null ? formatTrust(epochEmissions) : 'N/A'}</strong>
                    </div>

                    <div className="detail-row">
                      <span>
                        Current APY (now) <InfoTip text="The network's real annualized rate right now, based on current utilization. Not epoch-specific." />
                      </span>
                      <strong>
                        <AnimatedNumber value={liveData.currentApyPercent} decimals={1} suffix="%" />
                      </strong>
                    </div>

                    <div className="detail-row">
                      <span>
                        Maximum APY (now) <InfoTip text="The ceiling rate. What everyone would earn if the network hit 100% utilization." />
                      </span>
                      <strong>
                        <AnimatedNumber value={liveData.maxApyPercent} decimals={1} suffix="%" />
                      </strong>
                    </div>
                  </div>
                </div>

                <div className="epoch-footer">
                  <div>
                    <span>Epoch ends</span>
                    <strong>{formatDate(liveData.epochEndTimestamp)}</strong>
                  </div>
                  <div className="epoch-countdown">
                    <span>Time remaining</span>
                    <strong>{countdownText}</strong>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="dashboard-card calculator-card" id="calculator">
            <div className="card-header">
              <div>
                <span className="section-label">CALCULATOR</span>
                <h2>Build your lock</h2>
              </div>
              <div className="calculator-live">
                <span className="status-dot"></span>Live inputs
              </div>
            </div>

            <div className="calculator-form">
              <div className="field">
                <label>
                  Amount<span>TRUST</span>
                </label>
                <div className="input-wrap">
                  <input type="number" min="0" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
                  <span>TRUST</span>
                </div>
              </div>

              <div className="field">
                <label>
                  Lock duration
                  <InfoTip text="Confirmed live: max lock is 2 years. Longer locks give more bonded weight." />
                </label>
                <div className="custom-select-wrap">
                  <button
                    type="button"
                    className="custom-select-trigger"
                    onClick={() => setShowLockDropdown((v) => !v)}
                    onBlur={() => setTimeout(() => setShowLockDropdown(false), 150)}
                  >
                    <span>{LOCK_OPTIONS.find((d) => d.seconds === selectedLockSeconds)?.label}</span>
                    <span className="select-arrow">▾</span>
                  </button>
                  {showLockDropdown && (
                    <div className="custom-select-list">
                      {LOCK_OPTIONS.map((d) => (
                        <button
                          key={d.seconds}
                          type="button"
                          className={`custom-select-option ${d.seconds === selectedLockSeconds ? 'selected' : ''}`}
                          onMouseDown={() => {
                            setSelectedLockSeconds(d.seconds)
                            setShowLockDropdown(false)
                          }}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="field utilization-field">
                <div className="field-label-row">
                  <label>Personal utilization</label>
                  <strong className="utilization-value">{personalUtilization}%</strong>
                </div>
                <input
                  className="ember-range"
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={personalUtilization}
                  onChange={(e) => {
                    setPersonalUtilization(Number(e.target.value))
                    setWalletData(null)
                  }}
                />
                <div className="range-labels">
                  <span>0%</span>
                  <span>Protocol floor: 25%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>

            <div className="calculator-note">
              <span className="note-icon">i</span>
              <p>Personal utilization affects how much of your eligible reward you receive. The protocol maintains a 25% floor.</p>
            </div>
          </div>

          <div className="dashboard-card comparison-card">
            <div className="card-header">
              <div>
                <span className="section-label">SCENARIOS</span>
                <h2>Compare lock durations</h2>
                <p>See how locking longer changes your bonded weight and estimated reward.</p>
              </div>
              <div className="comparison-amount">{amount.toLocaleString()} TRUST</div>
            </div>

            <div className="comparison-list">
              {LOCK_OPTIONS.map((d) => {
                if (!liveData) return null
                const p = projectNewLock({
                  amount,
                  lockSeconds: d.seconds,
                  totalBondedBalance: liveData.totalBondedBalance,
                  derivedEpochEmissions: liveData.derivedEpochEmissions,
                  epochsPerYear: liveData.epochsPerYear,
                  personalUtilizationFraction,
                })
                const isSelected = d.seconds === selectedLockSeconds
                return (
                  <button
                    type="button"
                    key={d.seconds}
                    className={`comparison-row ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedLockSeconds(d.seconds)}
                  >
                    <div className="comparison-lock">
                      <span className={`lock-indicator ${isSelected ? 'selected' : ''}`} />
                      <div>
                        <strong>{d.label}</strong>
                        {isSelected && <span>Selected</span>}
                      </div>
                    </div>
                    <div className="comparison-stat bonded-stat">
                      <span>
                        Bonded weight{' '}
                        <InfoTip text="Bonded weight is based on your locked amount and lock duration. Longer locks give more bonded weight, up to the 2-year maximum." />
                      </span>
                      <strong>
                        <AnimatedNumber value={p.projectedVeTrust} decimals={2} />
                      </strong>
                    </div>
                    <div className="comparison-stat">
                      <span>Network share</span>
                      <strong>
                        <AnimatedNumber value={p.networkShare * 100} decimals={4} suffix="%" />
                      </strong>
                    </div>
                    <div className="comparison-stat reward-stat">
                      <span>Reward / epoch</span>
                      <strong className="ember-text">
                        <AnimatedNumber value={p.actualRewardPerEpoch} decimals={4} suffix=" TRUST" />
                      </strong>
                    </div>
                    <div className="comparison-stat apy-stat">
                      <span>Annualized reference</span>
                      <strong>
                        <AnimatedNumber value={p.annualizedApyPercent} decimals={2} suffix="%" />
                      </strong>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="comparison-footer">
              <span>Estimates use current network conditions and epoch emissions.</span>
              <span>Not a guarantee of future rewards.</span>
            </div>
          </div>

          <div className="dashboard-card wallet-dashboard-card" id="wallet">
            <div className="card-header">
              <div>
                <span className="section-label">YOUR POSITION</span>
                <h2>Check your real position</h2>
                <p>Pull your bonding and reward data from TrustBonding.</p>
              </div>
              {walletData && (
                <div className="wallet-live-tag">
                  <span className="status-dot"></span>On-chain
                </div>
              )}
            </div>

            <div className="wallet-search">
              <div className="wallet-input-wrap">
                <input
                  type="text"
                  placeholder="0x... / name.eth / name.trust"
                  value={walletInput}
                  onChange={(e) => {
                    setWalletInput(e.target.value)
                    setShowWalletDropdown(true)
                  }}
                  onFocus={() => setShowWalletDropdown(true)}
                  onBlur={() => setTimeout(() => setShowWalletDropdown(false), 150)}
                />
                {showWalletDropdown && filteredRecentWallets.length > 0 && (
                  <div className="wallet-dropdown">
                    {filteredRecentWallets.map((entry) => (
                      <button key={entry} onMouseDown={() => handleCheckWallet(entry)}>
                        {entry}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button className="ember-button" onClick={() => handleCheckWallet()} disabled={loadingWallet || !liveData}>
                {loadingWallet ? 'Checking...' : 'Check position'}
              </button>
            </div>

            {walletError && <div className="wallet-error">{walletError}</div>}

            {!walletData && !walletError && (
              <div className="wallet-empty">
                <div className="empty-icon">◎</div>
                <div>
                  <strong>No wallet loaded</strong>
                  <span>Enter an address, ENS name, or .trust name to see your position.</span>
                </div>
              </div>
            )}

            {walletData && !walletError && liveData && (
              <div className="wallet-position">
                <div className="wallet-summary">
                  <div>
                    <span>
                      Resolved wallet · Epoch {walletData.epochUsed}{' '}
                      {walletData.epochUsed === liveData.currentEpoch ? '(live)' : '(completed)'}
                    </span>
                    <strong>{resolvedAddress ? shortenAddress(resolvedAddress) : walletInput}</strong>
                  </div>
                  <button className="clear-button" onClick={handleClearWallet}>
                    Clear
                  </button>
                </div>

                <div className="wallet-stat-grid">
                  <div className="wallet-stat">
                    <span>Locked TRUST</span>
                    <strong>
                      <AnimatedNumber value={walletData.lockedAmount} decimals={2} suffix=" TRUST" />
                    </strong>
                  </div>
                  <div className="wallet-stat">
                    <span>Bonded weight</span>
                    <strong>
                      <AnimatedNumber value={walletData.bondedWeight} decimals={2} />
                    </strong>
                  </div>
                  <div className="wallet-stat">
                    <span>
                      Network share <InfoTip text="Your bonded weight as a share of everyone's combined bonded weight on the network." />
                    </span>
                    <strong>
                      <AnimatedNumber
                        value={liveData.totalBondedBalance > 0 ? (walletData.bondedWeight / liveData.totalBondedBalance) * 100 : 0}
                        decimals={4}
                        suffix="%"
                      />
                    </strong>
                  </div>
                  <div className="wallet-stat">
                    <span>Unlock date</span>
                    <strong>{walletData.lockEndTimestamp > 0 ? formatDate(walletData.lockEndTimestamp) : 'No active lock'}</strong>
                  </div>
                  <div className="wallet-stat highlight">
                    <span>
                      Personal APY <InfoTip text="Your own annualized rate, based on your specific bonded weight and utilization. Not the same as the network-wide APY." />
                    </span>
                    <strong>
                      <AnimatedNumber value={walletData.userCurrentApyPercent} decimals={1} suffix="%" />
                    </strong>
                  </div>
                  <div className="wallet-stat">
                    <span>
                      Personal utilization <InfoTip text="How much of your eligible reward you receive, based on your activity. The protocol guarantees a 25% floor even at 0%." />
                    </span>
                    <strong>
                      <AnimatedNumber value={walletData.personalUtilizationPercent} decimals={1} suffix="%" />
                    </strong>
                  </div>
                  <div className="wallet-stat">
                    <span>
                      Max potential reward <InfoTip text="What you'd earn this epoch at 100% Personal Utilization. Your actual reward is scaled down by your real utilization." />
                    </span>
                    <strong>
                      <AnimatedNumber value={walletData.maxPotentialReward} decimals={2} suffix=" TRUST" />
                    </strong>
                  </div>
                  <div className="wallet-stat highlight">
                    <span>Earned TRUST (this epoch)</span>
                    <strong>
                      <AnimatedNumber value={walletData.actualReward} decimals={2} suffix=" TRUST" />
                    </strong>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="dashboard-card analytics-card" id="analytics">
            <div className="analytics-content">
              <div>
                <span className="section-label">COMING NEXT</span>
                <h2>TrustBonding Analytics</h2>
                <p>Move beyond projections. Explore historical epochs, emissions, utilization and your rewards over time.</p>
              </div>
              <div className="analytics-preview">
                <div className="mini-chart">
                  <span style={{ height: '35%' }}></span>
                  <span style={{ height: '52%' }}></span>
                  <span style={{ height: '44%' }}></span>
                  <span style={{ height: '68%' }}></span>
                  <span style={{ height: '58%' }}></span>
                  <span style={{ height: '82%' }}></span>
                  <span style={{ height: '74%' }}></span>
                </div>
                <span className="analytics-soon">Historical epoch explorer</span>
              </div>
            </div>
          </div>
        </section>

      <footer className="dashboard-footer">
        <div>
          <span className="status-dot"></span>Data connected to TrustBonding
        </div>
        <div className="footer-links">
          <a href="/legal/privacy.html" target="_blank" rel="noopener noreferrer">Privacy</a>
          <a href="/legal/terms.html" target="_blank" rel="noopener noreferrer">Terms</a>
          <a href="/legal/storage.html" target="_blank" rel="noopener noreferrer">Local storage</a>
        </div>
      </footer>
      </main>

      <nav className="mobile-nav">
        <a href="#dashboard" className={`mobile-nav-item ${activeSection === 'dashboard' ? 'active' : ''}`}>
          <span>⌂</span>Dashboard
        </a>
        <a href="#calculator" className={`mobile-nav-item ${activeSection === 'calculator' ? 'active' : ''}`}>
          <span>⌘</span>Calculator
        </a>
        <a href="#wallet" className={`mobile-nav-item ${activeSection === 'wallet' ? 'active' : ''}`}>
          <span>◎</span>Wallet
        </a>
        <a href="#analytics" className={`mobile-nav-item ${activeSection === 'analytics' ? 'active' : ''}`}>
          <span>⌁</span>Analytics
        </a>
      </nav>
    </div>
  )
}

export default App
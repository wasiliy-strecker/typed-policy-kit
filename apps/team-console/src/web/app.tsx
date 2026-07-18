import { useEffect, useMemo, useState } from 'react'

import type { PolicyDecision } from 'typed-policy-core'

import type { TeamIssue, TeamRole, TeamUser } from '../shared/model'
import { teamPolicy, teamPolicyRules } from '../shared/policy'
import { loadIssues, loadUsers, transitionIssue, updateIssueTitle } from './api'
import { Can, PolicyProvider } from './policy-bindings'

const roleDescriptions: Record<TeamRole, string> = {
  viewer: 'Can read issues',
  contributor: 'Can edit own open issues',
  maintainer: 'Can edit and close open issues',
  admin: 'Can manage and archive issues',
}

export function App() {
  const [users, setUsers] = useState<readonly TeamUser[]>([])
  const [activeUserId, setActiveUserId] = useState('')
  const [issues, setIssues] = useState<readonly TeamIssue[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string>()

  const activeUser = users.find((user) => user.id === activeUserId)

  useEffect(() => {
    const controller = new AbortController()
    void loadUsers(controller.signal)
      .then(({ users: loadedUsers }) => {
        setUsers(loadedUsers)
        setActiveUserId((current) => current || loadedUsers[0]?.id || '')
      })
      .catch((error: unknown) => setMessage(readError(error)))
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (activeUserId.length === 0) return
    const controller = new AbortController()
    setLoading(true)
    setMessage(undefined)
    void loadIssues(activeUserId, controller.signal)
      .then(({ issues: loadedIssues }) => setIssues(loadedIssues))
      .catch((error: unknown) => setMessage(readError(error)))
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [activeUserId])

  async function performAction(
    issue: TeamIssue,
    action: 'edit' | 'close' | 'archive',
  ): Promise<void> {
    if (activeUser === undefined) return
    setMessage(undefined)
    try {
      const response =
        action === 'edit'
          ? await updateIssueTitle(activeUser.id, issue.id, `${issue.title} · reviewed`)
          : await transitionIssue(activeUser.id, issue, action)
      setIssues((current) =>
        current.map((existing) => (existing.id === response.issue.id ? response.issue : existing)),
      )
      setMessage(`${response.issue.key} was updated through the protected API.`)
    } catch (error) {
      setMessage(readError(error))
    }
  }

  const counts = useMemo(
    () => ({
      open: issues.filter((issue) => issue.status === 'open').length,
      closed: issues.filter((issue) => issue.status === 'closed').length,
      archived: issues.filter((issue) => issue.status === 'archived').length,
    }),
    [issues],
  )

  if (activeUser === undefined) {
    return <main className="loading-screen">Loading the policy workspace…</main>
  }

  return (
    <PolicyProvider subject={activeUser} context={{ tenantId: activeUser.tenantId }}>
      <div className="app-shell">
        <header className="topbar">
          <a className="brand" href="#top" aria-label="Typed Policy home">
            <span className="brand-mark" aria-hidden="true">
              TP
            </span>
            <span>
              <strong>typed-policy-kit</strong>
              <small>Team Console</small>
            </span>
          </a>
          <div className="security-status">
            <span className="pulse" />
            Server enforcement active
          </div>
          <label className="identity-switcher">
            <span>Acting as</span>
            <select
              aria-label="Acting as"
              value={activeUserId}
              onChange={(event) => setActiveUserId(event.target.value)}
            >
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} · {user.roles.join(', ')}
                </option>
              ))}
            </select>
          </label>
        </header>

        <main id="top">
          <section className="hero">
            <div>
              <p className="eyebrow">Authorization you can explain</p>
              <h1>
                One typed policy.
                <br />
                Two enforcement layers.
              </h1>
              <p className="hero-copy">
                React uses the policy for honest interfaces. Express checks every mutation again at
                the trust boundary.
              </p>
            </div>
            <div className="identity-card">
              <div className="avatar">{activeUser.initials}</div>
              <div>
                <span className="role-label">Current policy subject</span>
                <h2>{activeUser.name}</h2>
                <p>{activeUser.title}</p>
              </div>
              <span className={`role-pill role-${activeUser.roles[0]}`}>{activeUser.roles[0]}</span>
              <p className="role-description">{roleDescriptions[activeUser.roles[0]!]}</p>
            </div>
          </section>

          <section className="metrics" aria-label="Issue overview">
            <Metric label="Visible issues" value={issues.length} accent="violet" />
            <Metric label="Open" value={counts.open} accent="green" />
            <Metric label="Closed" value={counts.closed} accent="blue" />
            <Metric label="Archived" value={counts.archived} accent="amber" />
          </section>

          {message && (
            <div className="notice" role="status">
              {message}
            </div>
          )}

          <div className="workspace-grid">
            <section className="issue-section">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Northstar workspace</p>
                  <h2>Issue queue</h2>
                </div>
                <span className="policy-chip">{teamPolicy.name}</span>
              </div>

              {loading ? (
                <div className="empty-state">Evaluating workspace access…</div>
              ) : (
                <div className="issue-list">
                  {issues.map((issue) => (
                    <IssueCard key={issue.id} issue={issue} onAction={performAction} />
                  ))}
                </div>
              )}
            </section>

            <aside className="policy-panel">
              <div className="panel-heading">
                <span className="code-icon">{'{}'}</span>
                <div>
                  <p className="eyebrow">Live policy</p>
                  <h2>Decision model</h2>
                </div>
              </div>
              <div className="guarantee">
                <strong>Default deny</strong>
                <span>Explicit deny always wins</span>
              </div>
              <ol className="rule-list">
                {teamPolicyRules.map((rule, index) => (
                  <li key={rule.id}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <div>
                      <code>{rule.id}</code>
                      <p>{rule.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="trust-note">
                <span aria-hidden="true">↗</span>
                <p>
                  UI decisions improve usability. Only the Express middleware is a security
                  boundary.
                </p>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </PolicyProvider>
  )
}

function IssueCard({
  issue,
  onAction,
}: {
  readonly issue: TeamIssue
  readonly onAction: (issue: TeamIssue, action: 'edit' | 'close' | 'archive') => Promise<void>
}) {
  return (
    <article className={`issue-card status-${issue.status}`}>
      <div className="issue-stripe" />
      <div className="issue-content">
        <div className="issue-meta">
          <span className="issue-key">{issue.key}</span>
          <span className={`status-badge status-${issue.status}`}>{issue.status}</span>
          <span className={`priority priority-${issue.priority}`}>{issue.priority}</span>
        </div>
        <h3>{issue.title}</h3>
        <p>{issue.summary}</p>
        <div className="issue-footer">
          <span>Updated {new Date(issue.updatedAt).toLocaleDateString('en-GB')}</span>
          <div className="actions">
            <PolicyAction issue={issue} action="edit" onAction={onAction}>
              Edit
            </PolicyAction>
            <PolicyAction issue={issue} action="close" onAction={onAction}>
              Close
            </PolicyAction>
            <PolicyAction issue={issue} action="archive" onAction={onAction}>
              Archive
            </PolicyAction>
          </div>
        </div>
      </div>
    </article>
  )
}

function PolicyAction({
  issue,
  action,
  onAction,
  children,
}: {
  readonly issue: TeamIssue
  readonly action: 'edit' | 'close' | 'archive'
  readonly onAction: (issue: TeamIssue, action: 'edit' | 'close' | 'archive') => Promise<void>
  readonly children: string
}) {
  return (
    <Can
      resourceType="issue"
      resource={issue}
      action={action}
      fallback={(decision) => (
        <button
          className="action-button denied"
          disabled
          title={decisionLabel(decision)}
          aria-label={`${children} ${issue.key} denied`}
        >
          {children}
          <span aria-hidden="true">×</span>
        </button>
      )}
    >
      {(decision) => (
        <button
          className="action-button allowed"
          title={decisionLabel(decision)}
          onClick={() => void onAction(issue, action)}
          aria-label={`${children} ${issue.key}`}
        >
          {children}
          <span aria-hidden="true">↗</span>
        </button>
      )}
    </Can>
  )
}

function Metric({
  label,
  value,
  accent,
}: {
  readonly label: string
  readonly value: number
  readonly accent: string
}) {
  return (
    <div className={`metric metric-${accent}`}>
      <span>{label}</span>
      <strong>{value.toString().padStart(2, '0')}</strong>
    </div>
  )
}

function decisionLabel(decision: PolicyDecision): string {
  return decision.allowed
    ? `Allowed by ${decision.matchedRuleIds.join(', ')}`
    : decision.code === 'explicit_deny'
      ? `Denied by ${decision.matchedRuleIds.join(', ')}`
      : 'Denied because no allow rule matched'
}

function readError(error: unknown): string {
  return error instanceof Error ? error.message : 'The request could not be completed.'
}

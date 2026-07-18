import type { PolicySubject } from 'typed-policy-core'

export type TeamRole = 'viewer' | 'contributor' | 'maintainer' | 'admin'

export interface TeamUser extends PolicySubject<TeamRole> {
  readonly name: string
  readonly title: string
  readonly tenantId: string
  readonly initials: string
}

export type IssueStatus = 'open' | 'closed' | 'archived'

export interface TeamIssue {
  readonly id: string
  readonly key: string
  readonly title: string
  readonly summary: string
  readonly tenantId: string
  readonly authorId: string
  readonly priority: 'low' | 'medium' | 'high'
  readonly status: IssueStatus
  readonly updatedAt: string
}

export interface Workspace {
  readonly id: string
  readonly tenantId: string
}

export type TeamPolicySchema = {
  workspace: {
    resource: Workspace
    actions: 'view'
  }
  issue: {
    resource: TeamIssue
    actions: 'read' | 'edit' | 'close' | 'archive'
  }
}

export interface TeamPolicyContext {
  readonly tenantId: string
}

export interface IssueListResponse {
  readonly issues: readonly TeamIssue[]
  readonly policyName: string
}

export interface IssueResponse {
  readonly issue: TeamIssue
}

export interface UsersResponse {
  readonly users: readonly TeamUser[]
}

export interface ApiProblem {
  readonly title: string
  readonly detail: string
  readonly status: number
  readonly code: string
}

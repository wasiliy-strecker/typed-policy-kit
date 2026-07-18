import express, { type ErrorRequestHandler, type Request } from 'express'

import { createExpressPolicy, getPolicyResource } from 'typed-policy-express'
import type { PolicyDecision } from 'typed-policy-core'

import type {
  ApiProblem,
  IssueListResponse,
  IssueResponse,
  TeamIssue,
  TeamUser,
  UsersResponse,
  Workspace,
} from '../shared/model'
import { teamPolicy } from '../shared/policy'
import { fixtureIssues, fixtureUsers } from './fixtures'

export interface DecisionLogEntry {
  readonly subjectId: string
  readonly resourceType: string
  readonly action: string
  readonly decision: PolicyDecision
}

export interface TeamConsoleAppOptions {
  readonly issues?: readonly TeamIssue[]
  readonly users?: readonly TeamUser[]
  readonly onDecision?: (entry: DecisionLogEntry) => void
  readonly staticDirectory?: string
}

export function createTeamConsoleApp(options: TeamConsoleAppOptions = {}) {
  const app = express()
  const users = options.users ?? fixtureUsers
  let issues = [...(options.issues ?? fixtureIssues)]

  const findSubject = (request: Request): TeamUser | undefined =>
    users.find((user) => user.id === request.header('x-demo-user'))

  const enforcement = createExpressPolicy({
    policy: teamPolicy,
    getSubject: findSubject,
    getContext: (_request, subject) => ({ tenantId: subject.tenantId }),
    onDecision: (event) => {
      options.onDecision?.({
        subjectId: event.subject.id,
        resourceType: event.resourceType,
        action: event.action,
        decision: event.decision,
      })
    },
  })

  const loadIssue = (request: Request): TeamIssue | undefined =>
    issues.find((issue) => issue.id === request.params.id)

  app.disable('x-powered-by')
  app.use(express.json({ limit: '32kb' }))

  app.get('/api/users', (_request, response) => {
    const payload: UsersResponse = { users }
    response.json(payload)
  })

  app.get(
    '/api/issues',
    enforcement.requirePolicy({
      resourceType: 'workspace',
      action: 'view',
      loadResource: (request) => {
        const subject = findSubject(request)
        return subject === undefined
          ? undefined
          : { id: subject.tenantId, tenantId: subject.tenantId }
      },
    }),
    (_request, response) => {
      const workspace = getPolicyResource<Workspace>(response)
      const payload: IssueListResponse = {
        issues: issues.filter((issue) => issue.tenantId === workspace.tenantId),
        policyName: teamPolicy.name,
      }
      response.json(payload)
    },
  )

  app.patch(
    '/api/issues/:id',
    enforcement.requirePolicy({ resourceType: 'issue', action: 'edit', loadResource: loadIssue }),
    (request, response) => {
      const resource = getPolicyResource<TeamIssue>(response)
      const title = readTitle(request.body)
      if (title === undefined) {
        sendValidationProblem(response)
        return
      }
      const updated = { ...resource, title, updatedAt: new Date().toISOString() }
      issues = issues.map((issue) => (issue.id === updated.id ? updated : issue))
      const payload: IssueResponse = { issue: updated }
      response.json(payload)
    },
  )

  app.post(
    '/api/issues/:id/close',
    enforcement.requirePolicy({ resourceType: 'issue', action: 'close', loadResource: loadIssue }),
    (_request, response) => {
      const resource = getPolicyResource<TeamIssue>(response)
      const updated: TeamIssue = {
        ...resource,
        status: 'closed',
        updatedAt: new Date().toISOString(),
      }
      issues = issues.map((issue) => (issue.id === updated.id ? updated : issue))
      const payload: IssueResponse = { issue: updated }
      response.json(payload)
    },
  )

  app.post(
    '/api/issues/:id/archive',
    enforcement.requirePolicy({
      resourceType: 'issue',
      action: 'archive',
      loadResource: loadIssue,
    }),
    (_request, response) => {
      const resource = getPolicyResource<TeamIssue>(response)
      const updated: TeamIssue = {
        ...resource,
        status: 'archived',
        updatedAt: new Date().toISOString(),
      }
      issues = issues.map((issue) => (issue.id === updated.id ? updated : issue))
      const payload: IssueResponse = { issue: updated }
      response.json(payload)
    },
  )

  if (options.staticDirectory !== undefined) {
    app.use(express.static(options.staticDirectory))
    app.get('/*path', (_request, response) =>
      response.sendFile('index.html', { root: options.staticDirectory }),
    )
  }

  const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    const problem: ApiProblem = {
      title: 'Unexpected server error',
      detail: error instanceof Error ? error.message : 'The request could not be completed.',
      status: 500,
      code: 'unexpected_error',
    }
    response.status(500).type('application/problem+json').json(problem)
  }
  app.use(errorHandler)

  return app
}

function readTitle(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null || !('title' in body)) return undefined
  const title = body.title
  if (typeof title !== 'string') return undefined
  const normalized = title.trim()
  return normalized.length >= 3 && normalized.length <= 120 ? normalized : undefined
}

function sendValidationProblem(response: express.Response): void {
  const problem: ApiProblem = {
    title: 'Invalid issue title',
    detail: 'The title must contain between 3 and 120 characters.',
    status: 400,
    code: 'invalid_issue_title',
  }
  response.status(400).type('application/problem+json').json(problem)
}

import express, { type ErrorRequestHandler } from 'express'
import request from 'supertest'
import { describe, expect, it, vi, type Mock } from 'vitest'

import { definePolicy, type PolicySubject } from 'typed-policy-core'

import {
  createExpressPolicy,
  getPolicyDecision,
  getPolicyResource,
  type ExpressPolicyOptions,
} from '../src'

type Schema = {
  report: {
    resource: Report
    actions: 'read' | 'publish'
  }
}

interface Report {
  readonly id: string
  readonly tenantId: string
  readonly status: 'draft' | 'published'
}

interface Subject extends PolicySubject<'viewer' | 'publisher'> {
  readonly tenantId: string
}

const reports: readonly Report[] = [
  { id: 'report-1', tenantId: 'tenant-a', status: 'draft' },
  { id: 'report-2', tenantId: 'tenant-b', status: 'draft' },
]

const subjects: Record<string, Subject> = {
  viewer: { id: 'viewer-1', roles: ['viewer'], tenantId: 'tenant-a' },
  publisher: { id: 'publisher-1', roles: ['publisher'], tenantId: 'tenant-a' },
}

const policy = definePolicy<Schema, Subject, { readonly tenantId: string }>({
  name: 'reports',
  rules: [
    {
      id: 'same-tenant-read',
      effect: 'allow',
      roles: ['viewer', 'publisher'],
      resourceType: 'report',
      actions: ['read'],
      when: ({ resource, context }) => resource.tenantId === context.tenantId,
    },
    {
      id: 'same-tenant-publish',
      effect: 'allow',
      roles: ['publisher'],
      resourceType: 'report',
      actions: ['publish'],
      when: ({ resource, context }) => resource.tenantId === context.tenantId,
    },
  ],
})

type DecisionObserver = NonNullable<
  ExpressPolicyOptions<Schema, Subject, { readonly tenantId: string }>['onDecision']
>

function createApp(onDecision: Mock<DecisionObserver> = vi.fn<DecisionObserver>()) {
  const app = express()
  const enforcement = createExpressPolicy({
    policy,
    getSubject: (incoming) => subjects[incoming.header('x-test-user') ?? ''],
    getContext: (_incoming, subject) => ({ tenantId: subject.tenantId }),
    onDecision,
  })

  app.get(
    '/reports/:id',
    enforcement.requirePolicy({
      resourceType: 'report',
      action: 'read',
      loadResource: (incoming) => reports.find((report) => report.id === incoming.params.id),
    }),
    (_incoming, response) => {
      response.json({
        report: getPolicyResource<Report>(response),
        decision: getPolicyDecision(response),
      })
    },
  )

  app.post(
    '/reports/:id/publish',
    enforcement.requirePolicy({
      resourceType: 'report',
      action: 'publish',
      loadResource: (incoming) => reports.find((report) => report.id === incoming.params.id),
    }),
    (_incoming, response) => response.status(204).send(),
  )

  const errorHandler: ErrorRequestHandler = (error, _incoming, response, _next) => {
    response.status(500).json({ message: error instanceof Error ? error.message : 'Unknown error' })
  }
  app.use(errorHandler)
  return app
}

describe('Express policy enforcement', () => {
  it('authenticates before loading or exposing a resource', async () => {
    const response = await request(createApp()).get('/reports/report-1')

    expect(response.status).toBe(401)
    expect(response.headers['content-type']).toContain('application/problem+json')
    expect(response.body).toMatchObject({ code: 'policy_subject_missing' })
  })

  it('returns a resource-not-found problem after authentication', async () => {
    const response = await request(createApp()).get('/reports/missing').set('x-test-user', 'viewer')

    expect(response.status).toBe(404)
    expect(response.body).toMatchObject({ code: 'policy_resource_not_found' })
  })

  it('enforces tenant and role rules when the API is called directly', async () => {
    const wrongTenant = await request(createApp())
      .get('/reports/report-2')
      .set('x-test-user', 'viewer')
    const wrongRole = await request(createApp())
      .post('/reports/report-1/publish')
      .set('x-test-user', 'viewer')

    expect(wrongTenant.status).toBe(403)
    expect(wrongRole.status).toBe(403)
    expect(wrongRole.body).toEqual(expect.objectContaining({ code: 'policy_denied', status: 403 }))
    expect(wrongRole.body).not.toHaveProperty('matchedRuleIds')
  })

  it('passes the authorized resource and decision to the route', async () => {
    const onDecision = vi.fn<DecisionObserver>()
    const response = await request(createApp(onDecision))
      .get('/reports/report-1')
      .set('x-test-user', 'viewer')

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      report: { id: 'report-1' },
      decision: { allowed: true, matchedRuleIds: ['same-tenant-read'] },
    })
    expect(onDecision).toHaveBeenCalledOnce()
    const [event] = onDecision.mock.calls[0]!
    expect(event.resourceType).toBe('report')
    expect(event.action).toBe('read')
    expect(event.decision.allowed).toBe(true)
  })

  it('forwards unexpected policy failures to Express error handling', async () => {
    const brokenPolicy = definePolicy<Schema, Subject, { tenantId: string }>({
      name: 'broken',
      rules: [
        {
          id: 'broken-condition',
          effect: 'allow',
          resourceType: 'report',
          actions: ['read'],
          when: () => {
            throw new Error('Condition failed')
          },
        },
      ],
    })
    const app = express()
    const enforcement = createExpressPolicy({
      policy: brokenPolicy,
      getSubject: () => subjects.viewer,
      getContext: () => ({ tenantId: 'tenant-a' }),
    })
    app.get(
      '/',
      enforcement.requirePolicy({
        resourceType: 'report',
        action: 'read',
        loadResource: () => reports[0],
      }),
      (_incoming, response) => response.sendStatus(200),
    )
    app.use(((error, _incoming, response, _next) => {
      response.status(500).json({ name: error instanceof Error ? error.name : 'Unknown' })
    }) satisfies ErrorRequestHandler)

    const response = await request(app).get('/')

    expect(response.status).toBe(500)
    expect(response.body).toEqual({ name: 'PolicyEvaluationError' })
  })
})

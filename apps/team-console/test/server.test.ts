import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

import { createTeamConsoleApp } from '../src/server/app'

describe('Team Console API', () => {
  it('filters collection data to the active tenant', async () => {
    const response = await request(createTeamConsoleApp())
      .get('/api/issues')
      .set('x-demo-user', 'user-vivian')

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      issues: [
        expect.objectContaining({ key: 'NS-148' }),
        expect.objectContaining({ key: 'NS-139' }),
        expect.objectContaining({ key: 'NS-121' }),
      ],
    })
    expect(response.text).not.toContain('SB-42')
  })

  it('allows a contributor to edit their own issue', async () => {
    const response = await request(createTeamConsoleApp())
      .patch('/api/issues/issue-1')
      .set('x-demo-user', 'user-cora')
      .send({ title: 'Document invitation audit events' })

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      issue: {
        id: 'issue-1',
        title: 'Document invitation audit events',
      },
    })
  })

  it('denies the same contributor when the issue belongs to someone else', async () => {
    const response = await request(createTeamConsoleApp())
      .patch('/api/issues/issue-2')
      .set('x-demo-user', 'user-cora')
      .send({ title: 'Attempted direct API bypass' })

    expect(response.status).toBe(403)
    expect(response.body).toMatchObject({ code: 'policy_denied' })
  })

  it('prevents cross-tenant access on a direct resource URL', async () => {
    const response = await request(createTeamConsoleApp())
      .post('/api/issues/issue-4/close')
      .set('x-demo-user', 'user-malik')

    expect(response.status).toBe(403)
  })

  it('lets explicit deny override admin permissions for archived issues', async () => {
    const onDecision = vi.fn()
    const response = await request(createTeamConsoleApp({ onDecision }))
      .post('/api/issues/issue-3/archive')
      .set('x-demo-user', 'user-ada')

    expect(response.status).toBe(403)
    expect(onDecision).toHaveBeenCalledOnce()
    expect(onDecision.mock.calls[0]?.[0]).toMatchObject({
      decision: {
        allowed: false,
        code: 'explicit_deny',
        matchedRuleIds: ['archived-issues-are-immutable'],
      },
    })
  })

  it('validates write payloads after authorization', async () => {
    const response = await request(createTeamConsoleApp())
      .patch('/api/issues/issue-1')
      .set('x-demo-user', 'user-cora')
      .send({ title: 'x' })

    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({ code: 'invalid_issue_title' })
  })
})

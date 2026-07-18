import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import {
  PolicyDefinitionError,
  PolicyEvaluationError,
  definePolicy,
  type PolicyRule,
  type PolicySubject,
} from '../src'

type Role = 'viewer' | 'contributor' | 'maintainer' | 'admin'

interface Subject extends PolicySubject<Role> {
  readonly tenantId: string
}

interface Issue {
  readonly id: string
  readonly tenantId: string
  readonly authorId: string
  readonly status: 'open' | 'archived'
}

type TestSchema = {
  issue: {
    resource: Issue
    actions: 'read' | 'edit' | 'close'
  }
}

interface Context {
  readonly tenantId: string
}

const rules: readonly PolicyRule<TestSchema, Subject, Context>[] = [
  {
    id: 'same-tenant-read',
    effect: 'allow',
    roles: ['viewer', 'contributor', 'maintainer', 'admin'],
    resourceType: 'issue',
    actions: ['read'],
    when: ({ subject, resource, context }) =>
      subject.tenantId === context.tenantId && resource.tenantId === context.tenantId,
  },
  {
    id: 'owner-edit',
    effect: 'allow',
    roles: ['contributor'],
    resourceType: 'issue',
    actions: ['edit'],
    when: ({ subject, resource, context }) =>
      subject.id === resource.authorId && resource.tenantId === context.tenantId,
  },
  {
    id: 'maintainer-write',
    effect: 'allow',
    roles: ['maintainer', 'admin'],
    resourceType: 'issue',
    actions: ['edit', 'close'],
    when: ({ resource, context }) => resource.tenantId === context.tenantId,
  },
  {
    id: 'archived-is-immutable',
    effect: 'deny',
    resourceType: 'issue',
    actions: ['edit', 'close'],
    when: ({ resource }) => resource.status === 'archived',
  },
]

const policy = definePolicy<TestSchema, Subject, Context>({
  name: 'test-policy',
  rules,
})

const subject = (roles: readonly Role[], overrides: Partial<Subject> = {}): Subject => ({
  id: 'user-1',
  roles,
  tenantId: 'tenant-a',
  ...overrides,
})

const issue = (overrides: Partial<Issue> = {}): Issue => ({
  id: 'issue-1',
  tenantId: 'tenant-a',
  authorId: 'user-1',
  status: 'open',
  ...overrides,
})

const context: Context = { tenantId: 'tenant-a' }

describe('typed policy core', () => {
  it('denies by default when no allow rule matches', () => {
    expect(
      policy.decide({
        subject: subject(['viewer']),
        resourceType: 'issue',
        resource: issue(),
        action: 'edit',
        context,
      }),
    ).toEqual({ allowed: false, code: 'no_matching_allow', matchedRuleIds: [] })
  })

  it('returns every matching allow rule deterministically', () => {
    const decision = policy.decide({
      subject: subject(['viewer', 'contributor']),
      resourceType: 'issue',
      resource: issue(),
      action: 'read',
      context,
    })

    expect(decision).toEqual({
      allowed: true,
      code: 'allowed',
      matchedRuleIds: ['same-tenant-read'],
    })
    expect(Object.isFrozen(decision)).toBe(true)
    expect(Object.isFrozen(decision.matchedRuleIds)).toBe(true)
  })

  it('supports ownership and tenant conditions', () => {
    expect(
      policy.decide({
        subject: subject(['contributor']),
        resourceType: 'issue',
        resource: issue(),
        action: 'edit',
        context,
      }).allowed,
    ).toBe(true)

    expect(
      policy.decide({
        subject: subject(['contributor'], { id: 'another-user' }),
        resourceType: 'issue',
        resource: issue(),
        action: 'edit',
        context,
      }).allowed,
    ).toBe(false)
  })

  it('lets an explicit deny override every matching allow', () => {
    const decision = policy.decide({
      subject: subject(['admin']),
      resourceType: 'issue',
      resource: issue({ status: 'archived' }),
      action: 'edit',
      context,
    })

    expect(decision).toEqual({
      allowed: false,
      code: 'explicit_deny',
      matchedRuleIds: ['archived-is-immutable'],
    })
  })

  it('rejects ambiguous policy definitions', () => {
    expect(() =>
      definePolicy<TestSchema, Subject, Context>({
        name: 'invalid',
        rules: [rules[0]!, { ...rules[0]! }],
      }),
    ).toThrow(PolicyDefinitionError)

    expect(() =>
      definePolicy<TestSchema, Subject, Context>({
        name: 'invalid',
        rules: [{ ...rules[0]!, actions: [] }],
      }),
    ).toThrow('needs at least one action')
  })

  it('fails closed when trusted condition code throws', () => {
    const broken = definePolicy<TestSchema, Subject, Context>({
      name: 'broken',
      rules: [
        {
          id: 'broken-rule',
          effect: 'allow',
          resourceType: 'issue',
          actions: ['read'],
          when: () => {
            throw new Error('Unexpected policy failure')
          },
        },
      ],
    })

    expect(() =>
      broken.decide({
        subject: subject(['viewer']),
        resourceType: 'issue',
        resource: issue(),
        action: 'read',
        context,
      }),
    ).toThrow(PolicyEvaluationError)
  })

  it('preserves deny precedence for arbitrary role combinations and resource states', () => {
    fc.assert(
      fc.property(
        fc.subarray<Role>(['viewer', 'contributor', 'maintainer', 'admin'], {
          minLength: 1,
        }),
        fc.boolean(),
        (roles, archived) => {
          const decision = policy.decide({
            subject: subject(roles),
            resourceType: 'issue',
            resource: issue({ status: archived ? 'archived' : 'open' }),
            action: 'edit',
            context,
          })
          if (archived) {
            expect(decision).toMatchObject({ allowed: false, code: 'explicit_deny' })
          }
        },
      ),
    )
  })
})

import { describe, expect, it } from 'vitest'

import { definePolicy, type PolicySubject } from 'typed-policy-core'

import { PolicyAssertionError, createPolicyTestHarness } from '../src'

type Schema = {
  article: {
    resource: { readonly authorId: string }
    actions: 'read' | 'edit'
  }
}

type Subject = PolicySubject<'reader' | 'editor'>

const policy = definePolicy<Schema, Subject, undefined>({
  name: 'articles',
  rules: [
    {
      id: 'readers-can-read',
      effect: 'allow',
      roles: ['reader', 'editor'],
      resourceType: 'article',
      actions: ['read'],
    },
    {
      id: 'authors-can-edit',
      effect: 'allow',
      roles: ['editor'],
      resourceType: 'article',
      actions: ['edit'],
      when: ({ subject, resource }) => subject.id === resource.authorId,
    },
  ],
})

const harness = createPolicyTestHarness(policy)
const reader: Subject = { id: 'reader-1', roles: ['reader'] }
const article = { authorId: 'editor-1' }

describe('policy test harness', () => {
  it('returns narrowed allowed and denied decisions', () => {
    expect(
      harness.assertAllowed({
        subject: reader,
        resourceType: 'article',
        resource: article,
        action: 'read',
        context: undefined,
      }),
    ).toEqual({ allowed: true, code: 'allowed', matchedRuleIds: ['readers-can-read'] })

    expect(
      harness.assertDenied(
        {
          subject: reader,
          resourceType: 'article',
          resource: article,
          action: 'edit',
          context: undefined,
        },
        'no_matching_allow',
      ),
    ).toMatchObject({ allowed: false, code: 'no_matching_allow' })
  })

  it('reports the actual decision when an assertion fails', () => {
    expect(() =>
      harness.assertAllowed({
        subject: reader,
        resourceType: 'article',
        resource: article,
        action: 'edit',
        context: undefined,
      }),
    ).toThrow(PolicyAssertionError)

    try {
      harness.assertDenied(
        {
          subject: reader,
          resourceType: 'article',
          resource: article,
          action: 'read',
          context: undefined,
        },
        'explicit_deny',
      )
    } catch (error) {
      expect(error).toMatchObject({
        code: 'policy_assertion_failed',
        decision: { allowed: true, code: 'allowed' },
      })
    }
  })
})

import { expectError, expectType } from 'tsd'

import { definePolicy, type AllowedPolicyDecision, type PolicySubject } from 'typed-policy-core'
import { createPolicyTestHarness } from '..'

type Schema = {
  account: {
    resource: { readonly id: string }
    actions: 'view' | 'suspend'
  }
}

type Subject = PolicySubject<'support'>

const policy = definePolicy<Schema, Subject, undefined>({ name: 'accounts', rules: [] })
const harness = createPolicyTestHarness(policy)
const subject: Subject = { id: 'user-1', roles: ['support'] }
const resource = { id: 'account-1' }

expectType<AllowedPolicyDecision>(
  harness.assertAllowed({
    subject,
    resourceType: 'account',
    resource,
    action: 'view',
    context: undefined,
  }),
)

expectError(
  harness.assertAllowed({
    subject,
    resourceType: 'account',
    resource,
    action: 'delete',
    context: undefined,
  }),
)

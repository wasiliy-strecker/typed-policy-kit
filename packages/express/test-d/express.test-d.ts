import { expectError, expectType } from 'tsd'
import type { RequestHandler } from 'express'

import { definePolicy, type PolicySubject } from 'typed-policy-core'
import { createExpressPolicy } from '..'

type Schema = {
  project: {
    resource: { readonly id: string }
    actions: 'read' | 'archive'
  }
}

type Subject = PolicySubject<'member'>

const policy = definePolicy<Schema, Subject, undefined>({ name: 'projects', rules: [] })
const subject: Subject = { id: 'user-1', roles: ['member'] }
const enforcement = createExpressPolicy({
  policy,
  getSubject: () => subject,
  getContext: () => undefined,
})

expectType<RequestHandler>(
  enforcement.requirePolicy({
    resourceType: 'project',
    action: 'archive',
    loadResource: () => ({ id: 'project-1' }),
  }),
)

expectError(
  enforcement.requirePolicy({
    resourceType: 'project',
    action: 'delete',
    loadResource: () => ({ id: 'project-1' }),
  }),
)

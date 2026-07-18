import { expectError, expectType } from 'tsd'
import type { ReactNode } from 'react'

import { definePolicy, type PolicySubject } from 'typed-policy-core'
import { createPolicyBindings } from '..'

type Schema = {
  document: {
    resource: { readonly id: string }
    actions: 'read' | 'edit'
  }
}

type Subject = PolicySubject<'reader'>

const policy = definePolicy<Schema, Subject, undefined>({
  name: 'documents',
  rules: [],
})
const bindings = createPolicyBindings(policy)
const resource = { id: 'document-1' }

expectType<ReactNode>(
  bindings.Can({ resourceType: 'document', resource, action: 'read', children: 'Document' }),
)

expectError(
  bindings.Can({ resourceType: 'document', resource, action: 'delete', children: 'Document' }),
)

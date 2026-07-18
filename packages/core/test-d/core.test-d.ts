import { expectError, expectType } from 'tsd'

import { definePolicy, type PolicyDecision, type PolicyRule, type PolicySubject } from '..'

type Role = 'reader' | 'editor'
interface Subject extends PolicySubject<Role> {
  tenantId: string
}
interface DocumentResource {
  id: string
  tenantId: string
}
type Schema = {
  document: {
    resource: DocumentResource
    actions: 'read' | 'edit'
  }
}
interface Context {
  tenantId: string
}

const rules: readonly PolicyRule<Schema, Subject, Context>[] = [
  {
    id: 'reader-can-read',
    effect: 'allow',
    roles: ['reader'],
    resourceType: 'document',
    actions: ['read'],
  },
]
const policy = definePolicy<Schema, Subject, Context>({ name: 'documents', rules })
const subject: Subject = { id: 'user-1', roles: ['reader'], tenantId: 'tenant-a' }
const resource: DocumentResource = { id: 'document-1', tenantId: 'tenant-a' }
const context: Context = { tenantId: 'tenant-a' }

expectType<PolicyDecision>(
  policy.decide({ subject, resourceType: 'document', resource, action: 'read', context }),
)

expectError(
  policy.decide({ subject, resourceType: 'document', resource, action: 'delete', context }),
)

expectError(
  policy.decide({
    subject,
    resourceType: 'document',
    resource: { id: 'invalid' },
    action: 'read',
    context,
  }),
)

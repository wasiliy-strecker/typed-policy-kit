# typed-policy-core

Framework-independent, type-safe RBAC and contextual authorization for TypeScript.

```ts
import { definePolicy, type PolicySubject } from 'typed-policy-core'

type Schema = {
  document: {
    resource: { id: string; ownerId: string }
    actions: 'read' | 'edit'
  }
}

type User = PolicySubject<'reader' | 'editor'>

const policy = definePolicy<Schema, User, undefined>({
  name: 'documents',
  rules: [
    {
      id: 'editors-own-documents',
      effect: 'allow',
      roles: ['editor'],
      resourceType: 'document',
      actions: ['edit'],
      when: ({ subject, resource }) => subject.id === resource.ownerId,
    },
  ],
})

const decision = policy.decide({
  subject: { id: 'user-1', roles: ['editor'] },
  resourceType: 'document',
  resource: { id: 'doc-1', ownerId: 'user-1' },
  action: 'edit',
  context: undefined,
})
```

The evaluator denies by default, gives explicit deny rules precedence, and throws `PolicyEvaluationError` when predicate code fails. See the repository [authorization model](../../docs/authorization-model.md) for the full contract.

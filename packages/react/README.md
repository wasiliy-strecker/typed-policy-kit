# typed-policy-react

Typed React bindings for a `typed-policy-core` evaluator.

```tsx
const { PolicyProvider, Can, usePolicyDecision } = createPolicyBindings(policy)

<PolicyProvider subject={user} context={{ tenantId: user.tenantId }}>
  <Can resourceType="issue" resource={issue} action="edit" fallback="Read only">
    <button>Edit issue</button>
  </Can>
</PolicyProvider>
```

`Can` and `usePolicyDecision` infer valid actions and resource shapes from the policy schema. Decisions update with provider values and resource inputs.

This package improves UI behavior. Browser decisions are not a security boundary. Evaluate the policy again on every protected server operation.

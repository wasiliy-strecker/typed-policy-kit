# typed-policy-testkit

Small framework-neutral assertions for `typed-policy-core`.

```ts
const harness = createPolicyTestHarness(policy)

harness.assertAllowed({
  subject,
  resourceType: 'issue',
  resource: issue,
  action: 'read',
  context,
})

harness.assertDenied(
  {
    subject,
    resourceType: 'issue',
    resource: archivedIssue,
    action: 'edit',
    context,
  },
  'explicit_deny',
)
```

Failed assertions throw `PolicyAssertionError` and retain the actual decision for diagnostics.

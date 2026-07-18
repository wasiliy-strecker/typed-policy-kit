# typed-policy-express

Express 5 enforcement middleware for `typed-policy-core`.

```ts
const { requirePolicy } = createExpressPolicy({
  policy,
  getSubject: authenticateRequest,
  getContext: (_request, subject) => ({ tenantId: subject.tenantId }),
})

app.patch(
  '/issues/:id',
  requirePolicy({
    resourceType: 'issue',
    action: 'edit',
    loadResource: (request) => issueRepository.find(request.params.id),
  }),
  (_request, response) => {
    const issue = getPolicyResource<Issue>(response)
    response.json(updateIssue(issue))
  },
)
```

The middleware authenticates before loading a resource, returns RFC-style problem JSON for expected denials, forwards unexpected evaluation failures to Express error handling, and hands the already-authorized resource to the route.

Applications remain responsible for real authentication, trusted subject construction, persistence-level tenant controls, and safe error logging.

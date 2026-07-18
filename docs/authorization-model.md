# Authorization model

## Scope

`typed-policy-kit` evaluates whether an authenticated subject may perform one typed action on one typed resource in an application-defined context. It does not authenticate users, load identity claims, secure data stores, or distribute policies.

## Decision algorithm

For each request, the evaluator performs these steps in definition order:

1. Select rules with the exact resource type and action
2. Discard rules whose role list does not intersect the subject roles
3. Evaluate each remaining contextual predicate
4. Deny when one or more matching rules have the `deny` effect
5. Otherwise allow when one or more matching rules have the `allow` effect
6. Otherwise deny because no allow rule matched

Matched rule IDs preserve definition order. They are diagnostics, not secrets, and should be exposed only where the application considers them safe. The Express adapter intentionally omits rule IDs from 403 responses.

## Failure behavior

A policy definition is rejected at startup when it has an empty name, duplicate rule IDs, empty action lists, duplicate actions, empty role lists, or duplicate roles.

If a trusted predicate throws during evaluation, the core throws `PolicyEvaluationError` with the rule ID and original cause. It never converts that failure into an allow decision. The Express adapter forwards the error to normal Express error handling so applications can return a generic response and record diagnostics.

## Trust boundaries

The server must construct the subject from authenticated, integrity-protected identity data. Request headers in the demo simulate identities and are not a production authentication strategy.

Resource loaders must use trusted persistence code. Loading happens after authentication in the Express adapter, which avoids revealing whether a protected resource exists to anonymous callers. Authenticated callers receive a distinct not-found response before evaluation.

React decisions are safe for hiding, disabling, or explaining controls. A caller can modify browser code or invoke an API directly, so every protected server operation must evaluate the policy independently.

## Non-goals for 0.1

- Attribute or policy storage service
- Serialized JSON policy language
- Remote policy evaluation
- Asynchronous predicates
- Action wildcards
- Role hierarchy
- Automatic filtering of database queries
- Claims of exactly-once or globally consistent authorization

These omissions are deliberate. Applications can compose typed policy checks with their existing identity, tenancy, persistence, and observability systems without coupling the core to one infrastructure stack.

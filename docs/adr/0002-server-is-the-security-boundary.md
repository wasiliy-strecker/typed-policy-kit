# ADR 0002: Keep the server as the security boundary

- Status: accepted
- Date: 2026-07-18

## Context

Sharing one evaluator between React and Node.js reduces policy drift. It can also encourage the dangerous assumption that hiding a browser control prevents an operation.

## Decision

React bindings are explicitly a usability feature. Every protected API operation must evaluate the policy inside trusted server code. The Express adapter authenticates first, loads the resource, constructs trusted context, evaluates the policy, and only then invokes the route handler.

## Consequences

Applications perform a small amount of duplicate evaluation across browser and server. This is intentional. UI state remains responsive while direct HTTP calls, modified clients, and stale browser bundles cannot bypass server authorization.

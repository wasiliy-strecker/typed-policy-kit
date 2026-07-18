# ADR 0001: Use code-first synchronous policies

- Status: accepted
- Date: 2026-07-18

## Context

A policy can be represented as TypeScript functions, serialized data, or a dedicated expression language. Serialized or remote policies enable runtime editing but require schema validation, sandboxing, version negotiation, and a substantially larger threat model.

## Decision

Version 0.1 uses TypeScript policy definitions and synchronous contextual predicates. The compiler checks resource, action, role, and predicate input types. Evaluation contains no dynamic code generation, network access, or implicit asynchronous work.

## Consequences

Policies deploy with application code and benefit from normal review, tests, and version control. Evaluation remains deterministic and inexpensive to reuse in React.

Runtime policy editing and I/O inside predicates are not supported. Applications must load required attributes before calling the evaluator. A future execution model would require a separate ADR and must not silently change the synchronous API.

import type {
  AllowedPolicyDecision,
  DeniedPolicyDecision,
  PolicyDecision,
  PolicyEvaluator,
  PolicyRequest,
  PolicySubject,
  ResourceType,
} from 'typed-policy-core'

export class PolicyAssertionError extends Error {
  readonly code = 'policy_assertion_failed'

  constructor(
    message: string,
    readonly decision: PolicyDecision,
  ) {
    super(message)
    this.name = 'PolicyAssertionError'
  }
}

export interface PolicyTestHarness<TSchema, TSubject extends PolicySubject, TContext> {
  decide<TResourceType extends ResourceType<TSchema>>(
    request: PolicyRequest<TSchema, TSubject, TContext, TResourceType>,
  ): PolicyDecision

  assertAllowed<TResourceType extends ResourceType<TSchema>>(
    request: PolicyRequest<TSchema, TSubject, TContext, TResourceType>,
  ): AllowedPolicyDecision

  assertDenied<TResourceType extends ResourceType<TSchema>>(
    request: PolicyRequest<TSchema, TSubject, TContext, TResourceType>,
    expectedCode?: DeniedPolicyDecision['code'],
  ): DeniedPolicyDecision
}

export function createPolicyTestHarness<TSchema, TSubject extends PolicySubject, TContext>(
  policy: PolicyEvaluator<TSchema, TSubject, TContext>,
): PolicyTestHarness<TSchema, TSubject, TContext> {
  const decide: PolicyTestHarness<TSchema, TSubject, TContext>['decide'] = (request) =>
    policy.decide(request)

  function assertAllowed<TResourceType extends ResourceType<TSchema>>(
    request: PolicyRequest<TSchema, TSubject, TContext, TResourceType>,
  ): AllowedPolicyDecision {
    const decision = policy.decide(request)
    if (!decision.allowed) {
      throw new PolicyAssertionError(
        `Expected policy ${policy.name} to allow the request, but it returned ${decision.code}.`,
        decision,
      )
    }
    return decision
  }

  function assertDenied<TResourceType extends ResourceType<TSchema>>(
    request: PolicyRequest<TSchema, TSubject, TContext, TResourceType>,
    expectedCode?: DeniedPolicyDecision['code'],
  ): DeniedPolicyDecision {
    const decision = policy.decide(request)
    if (decision.allowed) {
      throw new PolicyAssertionError(
        `Expected policy ${policy.name} to deny the request, but it allowed it.`,
        decision,
      )
    }
    if (expectedCode !== undefined && decision.code !== expectedCode) {
      throw new PolicyAssertionError(
        `Expected policy ${policy.name} to deny with ${expectedCode}, but it returned ${decision.code}.`,
        decision,
      )
    }
    return decision
  }

  return Object.freeze({ decide, assertAllowed, assertDenied })
}

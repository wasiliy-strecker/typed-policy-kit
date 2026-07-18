import {
  createContext,
  createElement,
  useContext,
  useMemo,
  type ReactElement,
  type ReactNode,
} from 'react'

import type {
  ActionFor,
  PolicyDecision,
  PolicyEvaluator,
  PolicySubject,
  ResourceFor,
  ResourceType,
} from 'typed-policy-core'

interface PolicyEnvironment<TSubject extends PolicySubject, TContext> {
  readonly subject: TSubject
  readonly context: TContext
}

export interface PolicyProviderProps<TSubject extends PolicySubject, TContext> {
  readonly subject: TSubject
  readonly context: TContext
  readonly children?: ReactNode
}

export type PolicyDecisionInput<TSchema, TResourceType extends ResourceType<TSchema>> = {
  readonly resourceType: TResourceType
  readonly resource: ResourceFor<TSchema, TResourceType>
  readonly action: ActionFor<TSchema, TResourceType>
}

export type CanProps<TSchema, TResourceType extends ResourceType<TSchema>> = PolicyDecisionInput<
  TSchema,
  TResourceType
> & {
  readonly children?: ReactNode | ((decision: PolicyDecision) => ReactNode)
  readonly fallback?: ReactNode | ((decision: PolicyDecision) => ReactNode)
}

export interface PolicyBindings<TSchema, TSubject extends PolicySubject, TContext> {
  readonly PolicyProvider: (props: PolicyProviderProps<TSubject, TContext>) => ReactElement
  readonly Can: <TResourceType extends ResourceType<TSchema>>(
    props: CanProps<TSchema, TResourceType>,
  ) => ReactNode
  readonly usePolicyDecision: <TResourceType extends ResourceType<TSchema>>(
    input: PolicyDecisionInput<TSchema, TResourceType>,
  ) => PolicyDecision
}

export function createPolicyBindings<TSchema, TSubject extends PolicySubject, TContext>(
  policy: PolicyEvaluator<TSchema, TSubject, TContext>,
): PolicyBindings<TSchema, TSubject, TContext> {
  const EnvironmentContext = createContext<PolicyEnvironment<TSubject, TContext> | undefined>(
    undefined,
  )

  function usePolicyEnvironment(): PolicyEnvironment<TSubject, TContext> {
    const environment = useContext(EnvironmentContext)
    if (environment === undefined) {
      throw new Error('Policy bindings must be used inside their PolicyProvider.')
    }
    return environment
  }

  function PolicyProvider({
    subject,
    context,
    children,
  }: PolicyProviderProps<TSubject, TContext>): ReactElement {
    const value = useMemo(() => ({ subject, context }), [subject, context])
    return createElement(EnvironmentContext.Provider, { value }, children)
  }

  function usePolicyDecision<TResourceType extends ResourceType<TSchema>>({
    resourceType,
    resource,
    action,
  }: PolicyDecisionInput<TSchema, TResourceType>): PolicyDecision {
    const { subject, context } = usePolicyEnvironment()
    return useMemo(
      () => policy.decide({ subject, context, resourceType, resource, action }),
      [subject, context, resourceType, resource, action],
    )
  }

  function Can<TResourceType extends ResourceType<TSchema>>({
    children,
    fallback = null,
    ...input
  }: CanProps<TSchema, TResourceType>): ReactNode {
    const decision = usePolicyDecision(input)
    const output = decision.allowed ? children : fallback
    return typeof output === 'function' ? output(decision) : output
  }

  return Object.freeze({ PolicyProvider, Can, usePolicyDecision })
}

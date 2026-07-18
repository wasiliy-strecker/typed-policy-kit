export interface PolicyResourceDefinition {
  readonly resource: unknown
  readonly actions: string
}

export type PolicySchema = Record<string, PolicyResourceDefinition>

export interface PolicySubject<TRole extends string = string> {
  readonly id: string
  readonly roles: readonly TRole[]
}

export type ResourceType<TSchema> = Extract<keyof TSchema, string>

export type ResourceFor<
  TSchema,
  TResourceType extends ResourceType<TSchema>,
> = TSchema[TResourceType] extends { readonly resource: infer TResource } ? TResource : never

export type ActionFor<
  TSchema,
  TResourceType extends ResourceType<TSchema>,
> = TSchema[TResourceType] extends { readonly actions: infer TAction extends string }
  ? TAction
  : never

export type SubjectRole<TSubject extends PolicySubject> = TSubject['roles'][number]

export interface PolicyRuleInput<
  TSchema,
  TSubject extends PolicySubject,
  TContext,
  TResourceType extends ResourceType<TSchema>,
> {
  readonly subject: TSubject
  readonly resource: ResourceFor<TSchema, TResourceType>
  readonly context: TContext
}

export type PolicyRule<TSchema, TSubject extends PolicySubject, TContext> = {
  [TResourceType in ResourceType<TSchema>]: {
    readonly id: string
    readonly description?: string
    readonly effect: 'allow' | 'deny'
    readonly roles?: readonly SubjectRole<TSubject>[]
    readonly resourceType: TResourceType
    readonly actions: readonly ActionFor<TSchema, TResourceType>[]
    readonly when?: (input: PolicyRuleInput<TSchema, TSubject, TContext, TResourceType>) => boolean
  }
}[ResourceType<TSchema>]

export interface PolicyDefinition<TSchema, TSubject extends PolicySubject, TContext> {
  readonly name: string
  readonly rules: readonly PolicyRule<TSchema, TSubject, TContext>[]
}

export type PolicyRequest<
  TSchema,
  TSubject extends PolicySubject,
  TContext,
  TResourceType extends ResourceType<TSchema>,
> = {
  readonly subject: TSubject
  readonly resourceType: TResourceType
  readonly resource: ResourceFor<TSchema, TResourceType>
  readonly action: ActionFor<TSchema, TResourceType>
  readonly context: TContext
}

export type AnyPolicyRequest<TSchema, TSubject extends PolicySubject, TContext> = {
  [TResourceType in ResourceType<TSchema>]: PolicyRequest<
    TSchema,
    TSubject,
    TContext,
    TResourceType
  >
}[ResourceType<TSchema>]

export type PolicyDecision =
  | {
      readonly allowed: true
      readonly code: 'allowed'
      readonly matchedRuleIds: readonly string[]
    }
  | {
      readonly allowed: false
      readonly code: 'explicit_deny' | 'no_matching_allow'
      readonly matchedRuleIds: readonly string[]
    }

export type AllowedPolicyDecision = Extract<PolicyDecision, { readonly allowed: true }>

export type DeniedPolicyDecision = Extract<PolicyDecision, { readonly allowed: false }>

export interface PolicyEvaluator<TSchema, TSubject extends PolicySubject, TContext> {
  readonly name: string
  readonly ruleIds: readonly string[]
  decide<TResourceType extends ResourceType<TSchema>>(
    request: PolicyRequest<TSchema, TSubject, TContext, TResourceType>,
  ): PolicyDecision
}

export class PolicyDefinitionError extends Error {
  readonly code = 'invalid_policy_definition'

  constructor(message: string) {
    super(message)
    this.name = 'PolicyDefinitionError'
  }
}

export class PolicyEvaluationError extends Error {
  readonly code = 'policy_evaluation_error'

  constructor(
    readonly ruleId: string,
    cause: unknown,
  ) {
    super(`Policy rule ${ruleId} could not be evaluated.`, { cause })
    this.name = 'PolicyEvaluationError'
  }
}

interface RuntimeRule<TSubject extends PolicySubject, TContext> {
  readonly id: string
  readonly effect: 'allow' | 'deny'
  readonly roles?: readonly string[]
  readonly resourceType: string
  readonly actions: readonly string[]
  readonly when?: (input: {
    readonly subject: TSubject
    readonly resource: unknown
    readonly context: TContext
  }) => boolean
}

class PolicyEngine<TSchema, TSubject extends PolicySubject, TContext> implements PolicyEvaluator<
  TSchema,
  TSubject,
  TContext
> {
  readonly name: string
  readonly ruleIds: readonly string[]
  private readonly rules: readonly RuntimeRule<TSubject, TContext>[]

  constructor(definition: PolicyDefinition<TSchema, TSubject, TContext>) {
    this.name = requireName(definition.name)
    this.rules = normalizeRules(definition.rules)
    this.ruleIds = Object.freeze(this.rules.map((rule) => rule.id))
  }

  decide<TResourceType extends ResourceType<TSchema>>(
    request: PolicyRequest<TSchema, TSubject, TContext, TResourceType>,
  ): PolicyDecision {
    const matching: RuntimeRule<TSubject, TContext>[] = []

    for (const rule of this.rules) {
      if (rule.resourceType !== request.resourceType || !rule.actions.includes(request.action)) {
        continue
      }
      if (rule.roles && !request.subject.roles.some((role) => rule.roles?.includes(role))) {
        continue
      }
      if (rule.when) {
        let applies: boolean
        try {
          applies = rule.when({
            subject: request.subject,
            resource: request.resource,
            context: request.context,
          })
        } catch (error) {
          throw new PolicyEvaluationError(rule.id, error)
        }
        if (!applies) continue
      }
      matching.push(rule)
    }

    const deniedBy = matching.filter((rule) => rule.effect === 'deny').map((rule) => rule.id)
    if (deniedBy.length > 0) {
      return freezeDecision({ allowed: false, code: 'explicit_deny', matchedRuleIds: deniedBy })
    }

    const allowedBy = matching.filter((rule) => rule.effect === 'allow').map((rule) => rule.id)
    if (allowedBy.length > 0) {
      return freezeDecision({ allowed: true, code: 'allowed', matchedRuleIds: allowedBy })
    }

    return freezeDecision({ allowed: false, code: 'no_matching_allow', matchedRuleIds: [] })
  }
}

export function definePolicy<TSchema, TSubject extends PolicySubject, TContext>(
  definition: PolicyDefinition<TSchema, TSubject, TContext>,
): PolicyEvaluator<TSchema, TSubject, TContext> {
  return Object.freeze(new PolicyEngine(definition))
}

function normalizeRules<TSchema, TSubject extends PolicySubject, TContext>(
  rules: readonly PolicyRule<TSchema, TSubject, TContext>[],
): readonly RuntimeRule<TSubject, TContext>[] {
  const ids = new Set<string>()
  return Object.freeze(
    rules.map((rule, index) => {
      const id = requireName(rule.id, `Rule at index ${index} needs a non-empty ID.`)
      if (ids.has(id)) throw new PolicyDefinitionError(`Policy rule ID ${id} is duplicated.`)
      ids.add(id)
      if (rule.actions.length === 0) {
        throw new PolicyDefinitionError(`Policy rule ${id} needs at least one action.`)
      }
      if (new Set(rule.actions).size !== rule.actions.length) {
        throw new PolicyDefinitionError(`Policy rule ${id} contains duplicate actions.`)
      }
      if (rule.roles?.length === 0) {
        throw new PolicyDefinitionError(`Policy rule ${id} must omit roles or list at least one.`)
      }
      if (rule.roles && new Set(rule.roles).size !== rule.roles.length) {
        throw new PolicyDefinitionError(`Policy rule ${id} contains duplicate roles.`)
      }

      const runtimeRule = rule as unknown as RuntimeRule<TSubject, TContext>
      return Object.freeze({
        id,
        effect: runtimeRule.effect,
        ...(runtimeRule.roles ? { roles: Object.freeze([...runtimeRule.roles]) } : {}),
        resourceType: runtimeRule.resourceType,
        actions: Object.freeze([...runtimeRule.actions]),
        ...(runtimeRule.when ? { when: runtimeRule.when } : {}),
      })
    }),
  )
}

function requireName(value: string, message = 'A policy needs a non-empty name.'): string {
  const normalized = value.trim()
  if (normalized.length === 0) throw new PolicyDefinitionError(message)
  return normalized
}

function freezeDecision(decision: PolicyDecision): PolicyDecision {
  return Object.freeze({
    ...decision,
    matchedRuleIds: Object.freeze([...decision.matchedRuleIds]),
  })
}

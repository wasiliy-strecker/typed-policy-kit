import type { NextFunction, Request, RequestHandler, Response } from 'express'

import type {
  ActionFor,
  PolicyDecision,
  PolicyEvaluator,
  PolicySubject,
  ResourceFor,
  ResourceType,
} from 'typed-policy-core'

type MaybePromise<T> = T | Promise<T>

export interface PolicyProblem {
  readonly type: string
  readonly title: string
  readonly status: 401 | 403 | 404
  readonly detail: string
  readonly code: 'policy_subject_missing' | 'policy_denied' | 'policy_resource_not_found'
}

export type PolicyEnforcementEvent<TSchema, TSubject extends PolicySubject, TContext> = {
  [TResourceType in ResourceType<TSchema>]: {
    readonly subject: TSubject
    readonly resourceType: TResourceType
    readonly resource: ResourceFor<TSchema, TResourceType>
    readonly action: ActionFor<TSchema, TResourceType>
    readonly context: TContext
    readonly decision: PolicyDecision
  }
}[ResourceType<TSchema>]

export interface ExpressPolicyOptions<TSchema, TSubject extends PolicySubject, TContext> {
  readonly policy: PolicyEvaluator<TSchema, TSubject, TContext>
  readonly getSubject: (request: Request) => MaybePromise<TSubject | undefined>
  readonly getContext: (request: Request, subject: TSubject) => MaybePromise<TContext>
  readonly onDecision?: (
    event: PolicyEnforcementEvent<TSchema, TSubject, TContext>,
    request: Request,
  ) => MaybePromise<void>
}

export interface PolicyRequirement<TSchema, TResourceType extends ResourceType<TSchema>> {
  readonly resourceType: TResourceType
  readonly action: ActionFor<TSchema, TResourceType>
  readonly loadResource: (
    request: Request,
  ) => MaybePromise<ResourceFor<TSchema, TResourceType> | undefined>
}

export interface ExpressPolicy<TSchema> {
  requirePolicy<TResourceType extends ResourceType<TSchema>>(
    requirement: PolicyRequirement<TSchema, TResourceType>,
  ): RequestHandler
}

const resultLocal = Symbol('typed-policy-express-result')

interface StoredPolicyResult {
  readonly resource: unknown
  readonly decision: PolicyDecision
}

type PolicyResponse = Response & {
  locals: Response['locals'] & { [resultLocal]?: StoredPolicyResult }
}

export function createExpressPolicy<TSchema, TSubject extends PolicySubject, TContext>(
  options: ExpressPolicyOptions<TSchema, TSubject, TContext>,
): ExpressPolicy<TSchema> {
  function requirePolicy<TResourceType extends ResourceType<TSchema>>(
    requirement: PolicyRequirement<TSchema, TResourceType>,
  ): RequestHandler {
    return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
      try {
        const subject = await options.getSubject(request)
        if (subject === undefined) {
          sendProblem(response, {
            type: 'https://typed-policy.dev/problems/subject-missing',
            title: 'Authentication required',
            status: 401,
            detail: 'A policy subject is required for this operation.',
            code: 'policy_subject_missing',
          })
          return
        }

        const resource = await requirement.loadResource(request)
        if (resource === undefined) {
          sendProblem(response, {
            type: 'https://typed-policy.dev/problems/resource-not-found',
            title: 'Resource not found',
            status: 404,
            detail: 'The requested policy resource was not found.',
            code: 'policy_resource_not_found',
          })
          return
        }

        const context = await options.getContext(request, subject)
        const decision = options.policy.decide({
          subject,
          resourceType: requirement.resourceType,
          resource,
          action: requirement.action,
          context,
        })

        await options.onDecision?.(
          {
            subject,
            resourceType: requirement.resourceType,
            resource,
            action: requirement.action,
            context,
            decision,
          },
          request,
        )

        if (!decision.allowed) {
          sendProblem(response, {
            type: 'https://typed-policy.dev/problems/access-denied',
            title: 'Access denied',
            status: 403,
            detail: 'The active policy does not allow this operation.',
            code: 'policy_denied',
          })
          return
        }

        const policyResponse = response as PolicyResponse
        policyResponse.locals[resultLocal] = Object.freeze({ resource, decision })
        next()
      } catch (error) {
        next(error)
      }
    }
  }

  return Object.freeze({ requirePolicy })
}

export function getPolicyResource<TResource>(response: Response): TResource {
  const stored = (response as PolicyResponse).locals[resultLocal]
  if (stored === undefined) {
    throw new Error('No policy resource is available on this response.')
  }
  return stored.resource as TResource
}

export function getPolicyDecision(response: Response): PolicyDecision {
  const stored = (response as PolicyResponse).locals[resultLocal]
  if (stored === undefined) {
    throw new Error('No policy decision is available on this response.')
  }
  return stored.decision
}

function sendProblem(response: Response, problem: PolicyProblem): void {
  response.status(problem.status).type('application/problem+json').json(problem)
}

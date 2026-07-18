import { definePolicy, type PolicyRule } from 'typed-policy-core'

import type { TeamPolicyContext, TeamPolicySchema, TeamUser } from './model'

const sameTenant = ({
  subject,
  resource,
  context,
}: {
  readonly subject: TeamUser
  readonly resource: { readonly tenantId: string }
  readonly context: TeamPolicyContext
}) => subject.tenantId === context.tenantId && resource.tenantId === context.tenantId

export const teamPolicyRules = [
  {
    id: 'workspace-members-can-view',
    description: 'Every authenticated member can open their own workspace',
    effect: 'allow',
    resourceType: 'workspace',
    actions: ['view'],
    when: sameTenant,
  },
  {
    id: 'workspace-members-can-read-issues',
    description: 'Every member can read issues from their own tenant',
    effect: 'allow',
    resourceType: 'issue',
    actions: ['read'],
    when: sameTenant,
  },
  {
    id: 'contributors-can-edit-own-open-issues',
    description: 'Contributors can edit their own open issues',
    effect: 'allow',
    roles: ['contributor'],
    resourceType: 'issue',
    actions: ['edit'],
    when: ({ subject, resource, context }) =>
      sameTenant({ subject, resource, context }) &&
      subject.id === resource.authorId &&
      resource.status === 'open',
  },
  {
    id: 'maintainers-can-manage-open-issues',
    description: 'Maintainers can edit and close open issues in their tenant',
    effect: 'allow',
    roles: ['maintainer', 'admin'],
    resourceType: 'issue',
    actions: ['edit', 'close'],
    when: ({ subject, resource, context }) =>
      sameTenant({ subject, resource, context }) && resource.status === 'open',
  },
  {
    id: 'admins-can-archive-issues',
    description: 'Admins can archive active issues in their tenant',
    effect: 'allow',
    roles: ['admin'],
    resourceType: 'issue',
    actions: ['archive'],
    when: ({ subject, resource, context }) =>
      sameTenant({ subject, resource, context }) && resource.status !== 'archived',
  },
  {
    id: 'archived-issues-are-immutable',
    description: 'Archived issues cannot be changed, even by an admin',
    effect: 'deny',
    resourceType: 'issue',
    actions: ['edit', 'close', 'archive'],
    when: ({ resource }) => resource.status === 'archived',
  },
] as const satisfies readonly PolicyRule<TeamPolicySchema, TeamUser, TeamPolicyContext>[]

export const teamPolicy = definePolicy<TeamPolicySchema, TeamUser, TeamPolicyContext>({
  name: 'team-console-policy',
  rules: teamPolicyRules,
})

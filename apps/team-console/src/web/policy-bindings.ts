import { createPolicyBindings } from 'typed-policy-react'

import { teamPolicy } from '../shared/policy'

export const { Can, PolicyProvider, usePolicyDecision } = createPolicyBindings(teamPolicy)

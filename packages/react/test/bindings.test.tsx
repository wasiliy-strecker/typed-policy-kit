// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { definePolicy, type PolicySubject } from 'typed-policy-core'

import { createPolicyBindings } from '../src'

type Schema = {
  note: {
    resource: { readonly ownerId: string }
    actions: 'read' | 'edit'
  }
}

type Subject = PolicySubject<'reader' | 'editor'>

const policy = definePolicy<Schema, Subject, { readonly enabled: boolean }>({
  name: 'notes',
  rules: [
    {
      id: 'read-notes',
      effect: 'allow',
      roles: ['reader', 'editor'],
      resourceType: 'note',
      actions: ['read'],
    },
    {
      id: 'edit-own-note',
      effect: 'allow',
      roles: ['editor'],
      resourceType: 'note',
      actions: ['edit'],
      when: ({ subject, resource, context }) => context.enabled && subject.id === resource.ownerId,
    },
  ],
})

const { Can, PolicyProvider, usePolicyDecision } = createPolicyBindings(policy)
const reader: Subject = { id: 'reader-1', roles: ['reader'] }
const editor: Subject = { id: 'editor-1', roles: ['editor'] }
const note = { ownerId: 'editor-1' }

describe('React policy bindings', () => {
  it('renders children for an allowed decision and a fallback for a denial', () => {
    render(
      <PolicyProvider subject={reader} context={{ enabled: true }}>
        <Can resourceType="note" resource={note} action="read">
          <span>Visible note</span>
        </Can>
        <Can
          resourceType="note"
          resource={note}
          action="edit"
          fallback={(decision) => <span>Denied: {decision.code}</span>}
        >
          <span>Edit note</span>
        </Can>
      </PolicyProvider>,
    )

    expect(screen.getByText('Visible note')).toBeInTheDocument()
    expect(screen.getByText('Denied: no_matching_allow')).toBeInTheDocument()
    expect(screen.queryByText('Edit note')).not.toBeInTheDocument()
  })

  it('updates decisions when the subject or context changes', () => {
    const view = render(
      <PolicyProvider subject={reader} context={{ enabled: true }}>
        <Can resourceType="note" resource={note} action="edit" fallback={<span>Read only</span>}>
          <span>Editable</span>
        </Can>
      </PolicyProvider>,
    )

    expect(screen.getByText('Read only')).toBeInTheDocument()

    view.rerender(
      <PolicyProvider subject={editor} context={{ enabled: true }}>
        <Can resourceType="note" resource={note} action="edit" fallback={<span>Read only</span>}>
          <span>Editable</span>
        </Can>
      </PolicyProvider>,
    )

    expect(screen.getByText('Editable')).toBeInTheDocument()

    view.rerender(
      <PolicyProvider subject={editor} context={{ enabled: false }}>
        <Can resourceType="note" resource={note} action="edit" fallback={<span>Read only</span>}>
          <span>Editable</span>
        </Can>
      </PolicyProvider>,
    )

    expect(screen.getByText('Read only')).toBeInTheDocument()
  })

  it('exposes the complete decision through a hook', () => {
    function Probe() {
      const decision = usePolicyDecision({ resourceType: 'note', resource: note, action: 'read' })
      return <span>{`${decision.code}:${decision.matchedRuleIds.join(',')}`}</span>
    }

    render(
      <PolicyProvider subject={reader} context={{ enabled: true }}>
        <Probe />
      </PolicyProvider>,
    )

    expect(screen.getByText('allowed:read-notes')).toBeInTheDocument()
  })

  it('fails clearly outside the matching provider', () => {
    expect(() =>
      render(
        <Can resourceType="note" resource={note} action="read">
          Note
        </Can>,
      ),
    ).toThrow('inside their PolicyProvider')
  })
})

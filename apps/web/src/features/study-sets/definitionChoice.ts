/** Dialog copy for picking a looked-up definition, depending on whether the field already has text. */
export function describeDefinitionChoice(draft: string, term: string) {
  if (draft.trim()) {
    return {
      title: 'Replace existing definition?',
      description: `A definition was found for "${term}". Replacing will overwrite what you've typed.`,
      confirmLabel: 'Replace',
      showsCurrent: true,
    }
  }
  return {
    title: 'Choose a definition',
    description: `Definitions were found for "${term}". Pick a language to insert.`,
    confirmLabel: 'Insert',
    showsCurrent: false,
  }
}

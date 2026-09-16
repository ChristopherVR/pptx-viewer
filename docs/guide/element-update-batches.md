---
title: Batch Element Updates
description: Update elements across multiple slides as one undoable operation through the public viewer API.
---

# Batch element updates

Use `updateElements` when one host action needs to update elements on several
slides. For example, an "Adjust report titles" button can reposition titles on
two pages without navigating away from the page the user is editing.

The method is available on the public viewer handle in React, Vue, Angular,
Svelte, and Vanilla JS. `ElementUpdate` and `ElementUpdateOptions` are exported
from each binding's component package.

```ts
updateElements(
	updates: readonly ElementUpdate[],
	options?: ElementUpdateOptions,
): Promise<void>;

interface ElementUpdate {
	slideId: string;
	elementId: string;
	patch: Partial<PptxElement>;
}

interface ElementUpdateOptions {
	label?: string;
}
```

Here `viewer` is the current public component handle, and both slides already
contain a title element:

```ts
const [first, second] = viewer.getSlides();

await viewer.updateElements(
	[
		{
			slideId: first.id,
			elementId: first.elements[0].id,
			patch: { x: 84 },
		},
		{
			slideId: second.id,
			elementId: second.elements[0].id,
			patch: { x: 90 },
		},
	],
	{ label: 'Adjust report titles' },
);

viewer.undo(); // Restore both titles in one step.
viewer.redo(); // Reapply both updates in one step.
```

## Commit and history behavior

- Each effective batch creates one undo step, independent of previous and next
  edits, including another batch submitted in the same JavaScript turn.
- Applying a batch keeps the active slide and element selection. It does not
  navigate to the target slides. Undo and redo use the viewer's existing
  snapshot restoration behavior.
- Await completion before reading the result or issuing a dependent operation.
  In React, reacquire `ref.current` when reading through the public handle.
- Pending inline text is committed separately before an effective batch.
  Submit batches between completed pointer interactions, rather than during a
  drag or resize; all five bindings reject a batch while a pointer interaction is active.
  A rejected batch leaves pending text, document state, and undo history untouched.
- Empty batches and batches with no net change leave history and dirty state
  unchanged. Rejected batches preserve the document and undo/redo stacks.
- The existing `updateElement` method keeps its current-slide, individual-edit
  semantics.

## Targets, patches, and errors

Batches require a loaded, editable document in ordinary slide edit mode.
Read-only, preview, presentation, master, and template-editing contexts reject
the returned promise. Target IDs must resolve uniquely: `slideId` identifies a
slide, and `elementId` identifies a top-level element in that slide. Nested group
children and master/layout elements are outside this method's scope.

Every target and patch is checked before any update is committed. If a target is
missing or ambiguous, the entire batch rejects. Patches must be objects and
cannot replace an element's `id` or `type`. Position, size, and rotation fields
must be finite numbers; width and height cannot be negative. Other fields retain
the existing `Partial<PptxElement>` contract; this is not a full element-schema
validator.

Patches use shallow replacement, like `updateElement`: supply a complete nested
property value when replacing it. Multiple entries targeting the same element
apply in input order. Inputs are defensively copied, so changing a patch object
after calling the method cannot change the submitted batch.

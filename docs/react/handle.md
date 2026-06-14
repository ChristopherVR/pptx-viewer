---
title: Imperative Handle
description: The PowerPointViewerHandle ref API exposes getContent() to serialize the current document to .pptx bytes.
---

# Imperative Handle

`PowerPointViewer` is a `forwardRef` component. Attach a ref typed as `PowerPointViewerHandle` to
call its imperative API.

```tsx
import { PowerPointViewer } from 'pptx-react-viewer';
import type { PowerPointViewerHandle } from 'pptx-react-viewer';
import { useRef } from 'react';

function Editor({ content }: { content: Uint8Array }) {
	const ref = useRef<PowerPointViewerHandle>(null);

	async function save() {
		const bytes = await ref.current?.getContent();
		if (bytes) {
			// persist `bytes` (a Uint8Array)…
		}
	}

	return (
		<>
			<button onClick={save}>Save</button>
			<PowerPointViewer ref={ref} content={content} canEdit />
		</>
	);
}
```

## Interface

`PowerPointViewerHandle` extends a small `FileViewerHandle` base interface. The complete surface is:

```ts
interface FileViewerHandle {
	/** Get the current content of the file (for saving). */
	getContent: () => Promise<string | Uint8Array>;
}

interface PowerPointViewerHandle extends FileViewerHandle {
	getContent: () => Promise<Uint8Array>;
}
```

`PowerPointViewerHandle` narrows `getContent` to resolve a `Uint8Array` (the base allows
`string | Uint8Array`).

## Methods

| Method       | Signature                   | Description                                                                                                                                              |
| ------------ | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getContent` | `() => Promise<Uint8Array>` | Serializes the current in-memory document (slides, edits, theme, etc.) back to `.pptx` bytes and resolves a `Uint8Array`. Call this when the user saves. |

::: info This is the entire handle
`getContent` is the only method exposed via the ref. There are no imperative methods for
navigation, export, mode-switching, or print on the handle — those are driven through the
component's UI. For change notifications without calling `getContent`, use the
[`onContentChange` / `onDirtyChange`](/react/props#callbacks) props.
:::

::: tip getContent vs onContentChange
`getContent()` is a pull API — serialize on demand, e.g. when a Save button is clicked.
`onContentChange` is a push callback that fires with fresh bytes as the document changes. Use
whichever fits your save model; they return equivalent `Uint8Array` content.
:::

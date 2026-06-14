---
title: Getting Started
description: Load a .pptx ArrayBuffer into PowerPointViewer, render it read-only, then enable editing with dirty/content callbacks.
---

# Getting Started

This page walks from a read-only viewer to an editable one, wiring a file `<input>` and the
`onContentChange` / `onDirtyChange` callbacks.

::: tip Prerequisites
Install the package and its peer deps first — see [Overview › Installation](/react/#installation).
:::

## 1. Read-only viewer

The component takes its slide data through the `content` prop as a **`Uint8Array`** of raw `.pptx`
bytes. The component fills its parent, so give the parent an explicit height.

```tsx
import { PowerPointViewer } from 'pptx-react-viewer';
import { useEffect, useState } from 'react';

// If your app does NOT use Tailwind CSS v4, import the bundled stylesheet once
// at your entry point (see Theming for the three styling modes):
import 'pptx-react-viewer/styles';

export function ViewerOnly() {
	const [content, setContent] = useState<Uint8Array | null>(null);

	useEffect(() => {
		fetch('/presentation.pptx')
			.then((r) => r.arrayBuffer())
			.then((buf) => setContent(new Uint8Array(buf)));
	}, []);

	if (!content) return <div>Loading…</div>;

	return (
		<div style={{ height: '100vh' }}>
			<PowerPointViewer content={content} />
		</div>
	);
}
```

::: warning `content` is a `Uint8Array`
The prop type is `Uint8Array`, not `ArrayBuffer`. If you have an `ArrayBuffer` (e.g. from
`fetch(...).arrayBuffer()` or `file.arrayBuffer()`), wrap it: `new Uint8Array(buffer)`.
:::

## 2. Loading from a file `<input>`

```tsx
import { PowerPointViewer } from 'pptx-react-viewer';
import { useState } from 'react';

export function FilePickerViewer() {
	const [content, setContent] = useState<Uint8Array | null>(null);

	async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;
		const buf = await file.arrayBuffer();
		setContent(new Uint8Array(buf));
	}

	return (
		<div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
			<input type='file' accept='.pptx' onChange={handleFile} />
			<div style={{ flex: 1, minHeight: 0 }}>
				{content && <PowerPointViewer content={content} />}
			</div>
		</div>
	);
}
```

## 3. Enabling editing

Set `canEdit` to turn on the editing toolbar and inspector. Track changes with the callbacks:

- `onDirtyChange(isDirty)` — fires when the unsaved-changes flag flips.
- `onContentChange(content)` — fires with the **re-serialized `Uint8Array`** when the document changes.
- `onActiveSlideChange(index)` — fires when the active slide changes.

```tsx
import { PowerPointViewer } from 'pptx-react-viewer';
import { useRef, useState } from 'react';
import type { PowerPointViewerHandle } from 'pptx-react-viewer';

export function Editor({ initial }: { initial: Uint8Array }) {
	const ref = useRef<PowerPointViewerHandle>(null);
	const [dirty, setDirty] = useState(false);

	async function save() {
		const bytes = await ref.current?.getContent(); // Uint8Array
		if (bytes) {
			// POST to your server, write to disk, trigger a download, …
		}
	}

	return (
		<div style={{ height: '100vh' }}>
			<button onClick={save} disabled={!dirty}>
				Save{dirty ? ' *' : ''}
			</button>
			<PowerPointViewer
				ref={ref}
				content={initial}
				canEdit
				onDirtyChange={setDirty}
				onContentChange={(bytes) => {
					// `bytes` is the latest serialized document
				}}
				onActiveSlideChange={(i) => console.log('slide', i)}
			/>
		</div>
	);
}
```

::: info Saving
The most reliable way to retrieve the current document is the imperative handle's
[`getContent()`](/react/handle), which serializes on demand. `onContentChange` also delivers the
latest bytes as edits happen.
:::

## SSR and `'use client'`

`PowerPointViewer` is a client-only component — it reaches for the DOM, `window`, and browser APIs
(file/canvas/clipboard). In React Server Component frameworks (Next.js App Router, etc.), render it
from a client component and add the `'use client'` directive at the top of **your** wrapper module:

```tsx
'use client';
import { PowerPointViewer } from 'pptx-react-viewer';
// … your wrapper component
```

::: warning No bundled directive
The package source does not ship a `'use client'` directive on `PowerPointViewer`, so the boundary
must be declared on the consuming side. Avoid importing it into a server component directly, and
guard any pre-render code paths that touch `window`.
:::

## Styling / required CSS

There is **no mandatory CSS import** if your app already uses Tailwind CSS v4 with the shadcn-style
semantic tokens — the viewer's classes resolve through your existing config. Otherwise, import the
bundled stylesheet once at your entry point:

```tsx
import 'pptx-react-viewer/styles'; // or 'pptx-react-viewer/styles.css'
```

See [Theming](/react/theming) for the three styling modes and how to customise colours.

## Next steps

- [Component Props](/react/props) — every prop in detail.
- [Imperative Handle](/react/handle) — the ref API.
- [Export](/react/export) — turning slides into PNG/PDF/etc.

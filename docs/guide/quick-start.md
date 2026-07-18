---
title: Quick Start
description: Four end-to-end flows - create a presentation, parse and edit one, convert to Markdown, and render with the React viewer.
---

# Quick Start

This page walks through four common flows end to end. Each is self-contained and uses the real public API. For deeper references, follow the links in [Next steps](#next-steps).

## 1. Create a presentation from scratch

Use `PptxHandler.create()` to start a new deck, build slides with the fluent slide builder, then `save()` to bytes.

```ts
import { PptxHandler } from 'pptx-viewer-core';

const { handler, data, createSlide } = await PptxHandler.create({
	title: 'My Presentation',
	creator: 'Author Name',
	theme: {
		name: 'Custom Theme',
		colors: { accent1: '4472C4', accent2: 'ED7D31' },
		fonts: { majorFont: 'Calibri Light', minorFont: 'Calibri' },
	},
});

// Build a slide with the fluent API
const slide = createSlide()
	.addText('Hello World', { x: 100, y: 100, width: 600, height: 80, fontSize: 36 })
	.addShape('rect', { x: 100, y: 250, width: 300, height: 200 })
	.addImage('https://example.com/photo.jpg', { x: 450, y: 250, width: 300, height: 200 })
	.build();

data.slides.push(slide);

// Save to .pptx (returns a Uint8Array)
const output = await handler.save(data.slides);
await fs.writeFile('presentation.pptx', Buffer.from(output));
```

## 2. Parse and edit an existing presentation

Construct a `PptxHandler`, `load()` an `ArrayBuffer`, walk the [data model](/guide/data-model), mutate it, and `save()`.

```ts
import { PptxHandler } from 'pptx-viewer-core';

const handler = new PptxHandler();
const buffer = await fs.readFile('presentation.pptx');
const data = await handler.load(buffer.buffer);

console.log(`Loaded ${data.slides.length} slides`);
console.log(`Theme: ${data.theme?.name}`);

// Access slide content - narrow on the `type` discriminant
for (const slide of data.slides) {
	for (const element of slide.elements) {
		if (element.type === 'text') {
			console.log(`Text: ${element.text}`);
		}
	}
}

// Modify and save
data.slides[0].elements[0].text = 'Updated Title';
const output = await handler.save(data.slides);
await fs.writeFile('output.pptx', Buffer.from(output));
```

::: tip Narrowing elements
`slide.elements` is an array of the [`PptxElement`](/guide/data-model) discriminated union. Always check `element.type` before accessing variant-specific fields - see [Core Concepts](/guide/concepts#the-element-model).
:::

## 3. Convert to Markdown

`PptxMarkdownConverter` turns parsed `PptxData` into Markdown, optionally extracting media into a folder.

```ts
import { PptxHandler, PptxMarkdownConverter } from 'pptx-viewer-core';

const handler = new PptxHandler();
const data = await handler.load(buffer);

const converter = new PptxMarkdownConverter('./output', {
	sourceName: 'presentation.pptx',
	includeSpeakerNotes: true,
	mediaFolderName: 'media',
	includeMetadata: true,
	semanticMode: true, // Clean markdown vs positioned HTML
});

const markdown = await converter.convert(data);
console.log(markdown);
```

## 4. Render with the React viewer

The `PowerPointViewer` component renders a deck from a `Uint8Array` and can run in editable mode. The `onContentChange` callback receives the re-serialized `.pptx` bytes whenever the presentation is edited.

![The editable viewer with ribbon, thumbnails, and inspector](/docs-shots/editor.jpg)

```tsx
import { useState } from 'react';
import { PowerPointViewer } from 'pptx-react-viewer/viewer';

function App() {
	const [content, setContent] = useState<Uint8Array>();

	if (!content) return null;

	return (
		<PowerPointViewer
			content={content}
			canEdit
			onContentChange={(bytes) => {
				// `bytes` is the updated .pptx as a Uint8Array
				setContent(bytes);
			}}
		/>
	);
}
```

::: tip
See [Component Props](/react/props) for the full, source-verified prop reference - the viewer takes `Uint8Array` content (not `ArrayBuffer`), and `onContentChange` delivers serialized bytes rather than a dirty flag.
:::

Using Vue, Angular, Svelte, or no framework at all? See the [Vue](/vue/getting-started), [Angular](/angular/getting-started), [Svelte](/svelte/getting-started), or [Vanilla JS](/vanilla/getting-started) getting-started guides for the equivalent walkthrough in each binding.

## Next steps

- [Core package overview](/core/) - the full handler, builder, and converter APIs.
- [React package overview](/react/) - viewer props, editing, presenting, and export.
- [The PptxData Model](/guide/data-model) - the shape of parsed presentations.
- [Core Concepts](/guide/concepts) - EMU units, the element model, and theme resolution.

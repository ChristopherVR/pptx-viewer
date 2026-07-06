---
title: Schnellstart
description: Vier vollstandige Ablaufe - eine Prasentation erstellen, eine analysieren und bearbeiten, in Markdown konvertieren und mit dem React Viewer rendern.
---

# Schnellstart

Diese Seite fuhrt durch vier haufige Ablaufe von Anfang bis Ende. Jeder ist eigenstandig und nutzt die echte offentliche API.

## 1. Eine Prasentation von Grund auf erstellen

Verwenden Sie `PptxHandler.create()`, um ein neues Deck zu starten, bauen Sie Folien mit der flussigen Builder-API, dann `save()` fur die Bytes.

```ts
import { PptxHandler } from 'pptx-viewer-core';

const { handler, data, createSlide } = await PptxHandler.create({
	title: 'Meine Prasentation',
	creator: 'Autorname',
	theme: {
		name: 'Benutzerdefiniertes Design',
		colors: { accent1: '4472C4', accent2: 'ED7D31' },
		fonts: { majorFont: 'Calibri Light', minorFont: 'Calibri' },
	},
});

const slide = createSlide()
	.addText('Hallo Welt', { x: 100, y: 100, width: 600, height: 80, fontSize: 36 })
	.addShape('rect', { x: 100, y: 250, width: 300, height: 200 })
	.build();

data.slides.push(slide);

const output = await handler.save(data.slides);
await fs.writeFile('prasentation.pptx', Buffer.from(output));
```

## 2. Eine vorhandene Prasentation analysieren und bearbeiten

```ts
import { PptxHandler } from 'pptx-viewer-core';

const handler = new PptxHandler();
const buffer = await fs.readFile('prasentation.pptx');
const data = await handler.load(buffer.buffer);

console.log(`${data.slides.length} Folien geladen`);

for (const slide of data.slides) {
	for (const element of slide.elements) {
		if (element.type === 'text') {
			console.log(`Text: ${element.text}`);
		}
	}
}

data.slides[0].elements[0].text = 'Aktualisierter Titel';
const output = await handler.save(data.slides);
await fs.writeFile('ausgabe.pptx', Buffer.from(output));
```

::: tip Elemente einengen
`slide.elements` ist ein Array der diskriminierten Union [`PptxElement`](/de/guide/data-model). Prufen Sie immer `element.type`, bevor Sie auf variantenspezifische Felder zugreifen.
:::

## 3. In Markdown konvertieren

```ts
import { PptxHandler, PptxMarkdownConverter } from 'pptx-viewer-core';

const handler = new PptxHandler();
const data = await handler.load(buffer);

const converter = new PptxMarkdownConverter('./ausgabe', {
	sourceName: 'prasentation.pptx',
	includeSpeakerNotes: true,
	semanticMode: true,
});

const markdown = await converter.convert(data);
console.log(markdown);
```

## 4. Mit dem React Viewer rendern

```tsx
import { useState } from 'react';
import { PowerPointViewer } from 'pptx-react-viewer/viewer';

function App() {
	const [content, setContent] = useState<Uint8Array>();

	if (!content) return null;

	return (
		<PowerPointViewer content={content} canEdit onContentChange={(bytes) => setContent(bytes)} />
	);
}
```

## Nachste Schritte

- [Core-Paket-Uberblick](/core/) - die vollstandigen Handler-, Builder- und Converter-APIs.
- [React-Paket-Uberblick](/react/) - Viewer-Props, Bearbeitung, Prasentation und Export.
- [Das PptxData-Modell](/de/guide/data-model) - die Struktur analysierter Prasentation.

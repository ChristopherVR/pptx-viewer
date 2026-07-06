---
title: Demarrage rapide
description: Quatre flux de bout en bout - creer une presentation, analyser et editer, convertir en Markdown, et afficher avec le visualiseur React.
---

# Demarrage rapide

Cette page parcourt quatre flux courants de bout en bout. Chacun est autonome et utilise l'API publique reelle.

## 1. Creer une presentation depuis zero

Utilisez `PptxHandler.create()` pour demarrer un nouveau deck, construisez des diapositives avec l'API de construction fluide, puis `save()` pour obtenir les octets.

```ts
import { PptxHandler } from 'pptx-viewer-core';

const { handler, data, createSlide } = await PptxHandler.create({
	title: 'Ma Presentation',
	creator: 'Nom de l'auteur',
	theme: {
		name: 'Theme personnalise',
		colors: { accent1: '4472C4', accent2: 'ED7D31' },
		fonts: { majorFont: 'Calibri Light', minorFont: 'Calibri' },
	},
});

const slide = createSlide()
	.addText('Bonjour le monde', { x: 100, y: 100, width: 600, height: 80, fontSize: 36 })
	.addShape('rect', { x: 100, y: 250, width: 300, height: 200 })
	.build();

data.slides.push(slide);

const output = await handler.save(data.slides);
await fs.writeFile('presentation.pptx', Buffer.from(output));
```

## 2. Analyser et editer une presentation existante

Construisez un `PptxHandler`, `load()` un `ArrayBuffer`, parcourez le [modele de donnees](/fr/guide/data-model), modifiez-le et `save()`.

```ts
import { PptxHandler } from 'pptx-viewer-core';

const handler = new PptxHandler();
const buffer = await fs.readFile('presentation.pptx');
const data = await handler.load(buffer.buffer);

console.log(`Charge ${data.slides.length} diapositives`);

for (const slide of data.slides) {
	for (const element of slide.elements) {
		if (element.type === 'text') {
			console.log(`Texte: ${element.text}`);
		}
	}
}

data.slides[0].elements[0].text = 'Titre modifie';
const output = await handler.save(data.slides);
await fs.writeFile('sortie.pptx', Buffer.from(output));
```

::: tip Affiner les elements
`slide.elements` est un tableau de l'union discriminee [`PptxElement`](/fr/guide/data-model). Verifiez toujours `element.type` avant d'acceder aux champs specifiques au variant.
:::

## 3. Convertir en Markdown

`PptxMarkdownConverter` transforme les `PptxData` analyses en Markdown.

```ts
import { PptxHandler, PptxMarkdownConverter } from 'pptx-viewer-core';

const handler = new PptxHandler();
const data = await handler.load(buffer);

const converter = new PptxMarkdownConverter('./sortie', {
	sourceName: 'presentation.pptx',
	includeSpeakerNotes: true,
	semanticMode: true,
});

const markdown = await converter.convert(data);
console.log(markdown);
```

## 4. Afficher avec le visualiseur React

Le composant `PowerPointViewer` affiche un deck depuis un `Uint8Array`.

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

## Etapes suivantes

- [Apercu du package Core](/core/) - les API completes de handler, builder et converter.
- [Apercu du package React](/react/) - props du visualiseur, edition, presentation et export.
- [Le modele PptxData](/fr/guide/data-model) - la structure des presentations analysees.

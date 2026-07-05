---
title: Inicio rapido
description: Cuatro flujos de extremo a extremo - crear una presentacion, analizar y editar, convertir a Markdown, y renderizar con el visualizador React.
---

# Inicio rapido

Esta pagina recorre cuatro flujos comunes de extremo a extremo. Cada uno es autonomo y usa la API publica real.

## 1. Crear una presentacion desde cero

Use `PptxHandler.create()` para iniciar un nuevo deck, construya diapositivas con la API de construccion fluida, luego `save()` para obtener los bytes.

```ts
import { PptxHandler } from 'pptx-viewer-core';

const { handler, data, createSlide } = await PptxHandler.create({
	title: 'Mi Presentacion',
	creator: 'Nombre del autor',
	theme: {
		name: 'Tema personalizado',
		colors: { accent1: '4472C4', accent2: 'ED7D31' },
		fonts: { majorFont: 'Calibri Light', minorFont: 'Calibri' },
	},
});

const slide = createSlide()
	.addText('Hola Mundo', { x: 100, y: 100, width: 600, height: 80, fontSize: 36 })
	.addShape('rect', { x: 100, y: 250, width: 300, height: 200 })
	.build();

data.slides.push(slide);

const output = await handler.save(data.slides);
await fs.writeFile('presentacion.pptx', Buffer.from(output));
```

## 2. Analizar y editar una presentacion existente

```ts
import { PptxHandler } from 'pptx-viewer-core';

const handler = new PptxHandler();
const buffer = await fs.readFile('presentacion.pptx');
const data = await handler.load(buffer.buffer);

console.log(`Cargadas ${data.slides.length} diapositivas`);

for (const slide of data.slides) {
	for (const element of slide.elements) {
		if (element.type === 'text') {
			console.log(`Texto: ${element.text}`);
		}
	}
}

data.slides[0].elements[0].text = 'Titulo actualizado';
const output = await handler.save(data.slides);
await fs.writeFile('salida.pptx', Buffer.from(output));
```

::: tip Estrechar los elementos
`slide.elements` es un array de la union discriminada [`PptxElement`](/es/guide/data-model). Compruebe siempre `element.type` antes de acceder a campos especificos del variante.
:::

## 3. Convertir a Markdown

```ts
import { PptxHandler, PptxMarkdownConverter } from 'pptx-viewer-core';

const handler = new PptxHandler();
const data = await handler.load(buffer);

const converter = new PptxMarkdownConverter('./salida', {
	sourceName: 'presentacion.pptx',
	includeSpeakerNotes: true,
	semanticMode: true,
});

const markdown = await converter.convert(data);
console.log(markdown);
```

## 4. Renderizar con el visualizador React

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

## Proximos pasos

- [Descripcion del paquete Core](/core/) - las APIs completas de handler, builder y converter.
- [Descripcion del paquete React](/react/) - props del visualizador, edicion, presentacion y exportacion.
- [El modelo PptxData](/es/guide/data-model) - la estructura de las presentaciones analizadas.
- [Conceptos fundamentales](/es/guide/concepts) - unidades EMU, modelo de elementos y resolucion de tema.

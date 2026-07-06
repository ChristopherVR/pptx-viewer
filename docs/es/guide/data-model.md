---
title: El modelo PptxData
description: La forma de las presentaciones analizadas - PptxData, PptxSlide y cada tipo de elemento con sus campos clave.
---

# El modelo PptxData

Cuando llama a `handler.load(buffer)`, obtiene un `PptxData` - el objeto raiz que contiene todas las diapositivas, temas, mascaras y metadatos.

## Estructura de alto nivel

```ts
interface PptxData {
	slides: PptxSlide[];
	slideMasters: PptxSlideMaster[];
	theme?: PptxTheme;
	themeColorMap: Record<string, string>;
	widthEmu: number; // ancho de diapositiva en EMU
	heightEmu: number; // altura de diapositiva en EMU
	metadata?: PptxMetadata;
}
```

## PptxSlide

```ts
interface PptxSlide {
	elements: PptxElement[];
	layoutPath?: string;
	background?: PptxBackground;
	notes?: string;
	hidden?: boolean;
	slideNumber?: number;
	name?: string;
}
```

## La union PptxElement

`PptxElement` es una union discriminada en el campo `type`. Los 11 tipos de variantes son:

| `type`        | Interfaz               | Descripcion                           |
| ------------- | ---------------------- | ------------------------------------- |
| `'text'`      | `TextPptxElement`      | Cuadros de texto, titulos, cuerpo     |
| `'image'`     | `ImagePptxElement`     | Imagenes raster y metarchivos EMF/WMF |
| `'shape'`     | `ShapePptxElement`     | Formas geometricas y conectores       |
| `'table'`     | `TablePptxElement`     | Tablas con filas/columnas             |
| `'chart'`     | `ChartPptxElement`     | Graficos (23 tipos)                   |
| `'group'`     | `GroupPptxElement`     | Grupos que contienen otros elementos  |
| `'connector'` | `ConnectorPptxElement` | Conectores / lineas                   |
| `'smartArt'`  | `SmartArtPptxElement`  | Diagramas SmartArt                    |
| `'media'`     | `MediaPptxElement`     | Audio / video incrustado              |
| `'ink'`       | `InkPptxElement`       | Tinta digital                         |
| `'ole'`       | `OlePptxElement`       | Objetos OLE incrustados               |

## Campos comunes

Todos los tipos de elementos comparten estos campos base:

```ts
interface PptxElementBase {
	type: string;
	id: string;
	x: number; // posicion en pixeles aproximados
	y: number;
	width: number;
	height: number;
	rotation?: number;
	name?: string;
	hidden?: boolean;
}
```

## Trabajar con elementos

Estreche siempre en `type` antes de acceder a campos especificos del variante:

```ts
for (const element of slide.elements) {
	if (element.type === 'text') {
		console.log(element.text, element.fontFamily, element.fontSize);
	}
	if (element.type === 'group') {
		processElements(element.children);
	}
}
```

## Lecturas relacionadas

- [Arquitectura](/es/guide/architecture)

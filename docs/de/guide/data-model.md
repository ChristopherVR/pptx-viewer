---
title: Das PptxData-Modell
description: Die Struktur analysierter Prasentation - PptxData, PptxSlide und jeder Elementtyp mit seinen Schlusselfeldern.
---

# Das PptxData-Modell

Wenn Sie `handler.load(buffer)` aufrufen, erhalten Sie ein `PptxData` - das Stammobjekt, das alle Folien, Designs, Master und Metadaten enthalt.

## Struktur auf hoher Ebene

```ts
interface PptxData {
	slides: PptxSlide[];
	slideMasters: PptxSlideMaster[];
	theme?: PptxTheme;
	themeColorMap: Record<string, string>;
	widthEmu: number; // Folienbreite in EMU
	heightEmu: number; // Folienhohe in EMU
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

## Die PptxElement-Union

`PptxElement` ist eine diskriminierte Union auf dem `type`-Feld. Die 11 Variantentypen sind:

| `type`        | Interface              | Beschreibung                           |
| ------------- | ---------------------- | -------------------------------------- |
| `'text'`      | `TextPptxElement`      | Textfelder, Titel, Inhalt              |
| `'image'`     | `ImagePptxElement`     | Rasterbilder und EMF/WMF-Metadateien   |
| `'shape'`     | `ShapePptxElement`     | Geometrische Formen und Verbinder      |
| `'table'`     | `TablePptxElement`     | Tabellen mit Zeilen/Spalten            |
| `'chart'`     | `ChartPptxElement`     | Diagramme (23 Typen)                   |
| `'group'`     | `GroupPptxElement`     | Gruppen, die andere Elemente enthalten |
| `'connector'` | `ConnectorPptxElement` | Verbinder / Linien                     |
| `'smartArt'`  | `SmartArtPptxElement`  | SmartArt-Diagramme                     |
| `'media'`     | `MediaPptxElement`     | Eingebettetes Audio / Video            |
| `'ink'`       | `InkPptxElement`       | Digitale Tinte                         |
| `'ole'`       | `OlePptxElement`       | Eingebettete OLE-Objekte               |

## Gemeinsame Felder

Alle Elementtypen teilen diese Basisfelder:

```ts
interface PptxElementBase {
	type: string;
	id: string;
	x: number; // Position in naherungsweisen Pixeln
	y: number;
	width: number;
	height: number;
	rotation?: number;
	name?: string;
	hidden?: boolean;
}
```

## Mit Elementen arbeiten

Engen Sie immer auf `type` ein, bevor Sie auf variantenspezifische Felder zugreifen:

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

## Weiterfuhrend

- [Architektur](/de/guide/architecture)

---
title: The PptxData Model
description: The shape of the parsed PptxData model — slides, theme, masters, and metadata — and the full PptxElement discriminated union.
---

# The PptxData Model

`handler.load()` returns a single `PptxData` object: the fully parsed, in-memory representation of a presentation. Editing means mutating this object; saving serializes it back to a `.pptx` archive.

## `PptxData`

The top-level model. The most-used fields are listed here; the interface also carries extensive metadata for lossless round-trip.

```ts
interface PptxData {
	slides: PptxSlide[]; // the slides, in order
	width: number; // presentation width in pixels (approx)
	height: number; // presentation height in pixels (approx)
	widthEmu?: number; // slide width in EMU (round-trip)
	heightEmu?: number; // slide height in EMU (round-trip)
	slideSizeType?: string; // e.g. "screen4x3", "screen16x9", "custom"

	theme?: PptxTheme; // full parsed theme (colours, fonts, name)
	themeColorMap?: Record<string, string>; // colour scheme key → hex
	slideMasters?: PptxSlideMaster[]; // masters (each with its layouts)

	sections?: PptxSection[]; // ordered presentation sections
	customShows?: PptxCustomShow[]; // named custom slide shows
	embeddedFonts?: PptxEmbeddedFont[];

	// document metadata
	coreProperties?: PptxCoreProperties; // docProps/core.xml
	appProperties?: PptxAppProperties; // docProps/app.xml
	customProperties?: PptxCustomProperty[]; // docProps/custom.xml

	// flags
	isPasswordProtected?: boolean;
	hasMacros?: boolean; // is a .pptm
	hasDigitalSignatures?: boolean;
	conformance?: 'strict' | 'transitional'; // original OOXML conformance class

	warnings?: PptxCompatibilityWarning[]; // unsupported-feature notices
}
```

::: info Pixels vs EMU
`width` / `height` are approximate pixels for convenient layout math; `widthEmu` / `heightEmu` preserve the exact source values for round-trip. See [EMU units](/guide/concepts#emu-units).
:::

## `PptxSlide`

Each entry in `data.slides`. The `elements` array holds the authored content.

```ts
interface PptxSlide {
	id: string;
	rId: string; // relationship ID
	slideNumber: number;
	name?: string; // optional author-supplied name
	layoutPath?: string; // the layout this slide is based on
	layoutName?: string;
	hidden?: boolean; // hidden slides are skipped in presentation mode
	sectionName?: string;
	sectionId?: string;
	elements: PptxElement[]; // the slide's content
	backgroundColor?: string;
	backgroundImage?: string; // base64 data URL
	backgroundGradient?: string; // CSS gradient string
	backgroundPattern?: PptxSlideBackgroundPattern;
}
```

A slide resolves its unspecified styling through its layout and master — see the [theme resolution chain](/guide/concepts#theme-resolution-chain).

## The `PptxElement` union

`slide.elements` is an array of the `PptxElement` discriminated union. Narrow on the `type` field to access variant-specific properties.

| `type` string   | Interface                | Description                                                                            |
| --------------- | ------------------------ | -------------------------------------------------------------------------------------- |
| `"text"`        | `TextPptxElement`        | A text box — a rectangle containing text, usually with no visible fill or stroke.      |
| `"shape"`       | `ShapePptxElement`       | A shape with preset or freeform geometry; may also contain text.                       |
| `"connector"`   | `ConnectorPptxElement`   | A straight, bent, or curved line linking shapes, with optional arrowheads.             |
| `"image"`       | `ImagePptxElement`       | A raster image from a `<p:pic>` node.                                                  |
| `"picture"`     | `PicturePptxElement`     | Functionally identical to `image`, distinguished by discriminant for semantic clarity. |
| `"table"`       | `TablePptxElement`       | A table embedded via a `<p:graphicFrame>`; cells in `tableData`.                       |
| `"chart"`       | `ChartPptxElement`       | A chart embedded via a `<p:graphicFrame>`; data in `chartData`.                        |
| `"smartArt"`    | `SmartArtPptxElement`    | A SmartArt diagram decomposed to positioned shapes; data in `smartArtData`.            |
| `"ole"`         | `OlePptxElement`         | An OLE object (embedded Excel/Word/PDF/Visio/MathType) with a preview image.           |
| `"media"`       | `MediaPptxElement`       | An audio or video element referencing a file in the archive.                           |
| `"group"`       | `GroupPptxElement`       | A container whose `children` inherit the group's transform.                            |
| `"ink"`         | `InkPptxElement`         | Freehand stylus/mouse strokes stored as SVG paths, with optional pressure.             |
| `"contentPart"` | `ContentPartPptxElement` | An `mc:AlternateContent` content part, typically modern pen/highlighter ink.           |
| `"zoom"`        | `ZoomPptxElement`        | A Slide Zoom or Section Zoom object that navigates to a target slide.                  |
| `"model3d"`     | `Model3DPptxElement`     | A 3D model (`.glb`/`.gltf`) embedded via `p16:model3D`, with a poster image.           |
| `"unknown"`     | `UnknownPptxElement`     | An element the parser does not recognise; preserved for round-trip.                    |

::: tip Subset aliases
For function signatures that accept a subset, the core package exports helper aliases such as `PptxElementWithText` (`text` | `shape` | `connector`), `PptxElementWithShapeStyle`, and `PptxImageLikeElement` (`image` | `picture`).
:::

## Iterating and narrowing

```ts
import { PptxHandler } from 'pptx-viewer-core';
import type { PptxElement } from 'pptx-viewer-core';

const handler = new PptxHandler();
const data = await handler.load(buffer);

function summarize(elements: PptxElement[]) {
	for (const element of elements) {
		switch (element.type) {
			case 'text':
				console.log('text:', element.text);
				break;
			case 'image':
			case 'picture':
				console.log('image:', element.imagePath);
				break;
			case 'table':
				console.log('table rows:', element.tableData?.rows.length ?? 0);
				break;
			case 'chart':
				console.log('chart:', element.chartData?.chartType);
				break;
			case 'group':
				summarize(element.children); // recurse into the group
				break;
			default:
				console.log('element:', element.type);
		}
	}
}

for (const slide of data.slides) {
	summarize(slide.elements);
}
```

## Related reading

- [Core Concepts](/guide/concepts) — the element model and theme resolution explained.
- [Core package overview](/core/) — handler, builder, and converter APIs.

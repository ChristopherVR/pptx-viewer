---
title: Core Concepts
description: The mental model behind pptx-viewer — EMU units, the discriminated-union element model, the theme resolution chain, and how slides, masters, and layouts relate.
---

# Core Concepts

A few ideas show up everywhere in `pptx-viewer`. Understanding them up front makes the rest of the API feel obvious.

## EMU units

PowerPoint stores positions and sizes internally in **English Metric Units (EMU)**, a high-resolution integer unit that avoids floating-point rounding. All EMU conversion constants live in `core/constants.ts`:

| Constant        | Value    | Meaning                          |
| --------------- | -------- | -------------------------------- |
| `EMU_PER_INCH`  | `914400` | EMU in one inch                  |
| `EMU_PER_POINT` | `12700`  | EMU in one typographic point     |
| `EMU_PER_PIXEL` | `9525`   | EMU in one CSS pixel (at 96 DPI) |

### Quick conversion table

| From   | To EMU     | Example                 |
| ------ | ---------- | ----------------------- |
| inches | `× 914400` | `1 in` = `914400` EMU   |
| points | `× 12700`  | `18 pt` = `228600` EMU  |
| pixels | `× 9525`   | `100 px` = `952500` EMU |

```ts
const EMU_PER_PIXEL = 9525;

// EMU → pixels
const px = emuValue / EMU_PER_PIXEL;

// pixels → EMU
const emu = px * EMU_PER_PIXEL;
```

::: info Pixels in the data model
Element `x`, `y`, `width`, and `height` fields on a parsed [`PptxElement`](/guide/data-model) are already expressed in **approximate pixels** for convenience. The original EMU values are preserved where round-trip fidelity requires them (for example, `PptxData.widthEmu` / `heightEmu` for the slide size).
:::

## The element model

Everything on a slide is a `PptxElement` — a **discriminated union** of concrete element types. The discriminant is the `type` string field. Narrowing on `type` unlocks the variant-specific properties with full type safety and no casting:

```ts
for (const element of slide.elements) {
	switch (element.type) {
		case 'text':
			console.log(element.text); // TextPptxElement only
			break;
		case 'image':
			console.log(element.imagePath); // ImagePptxElement only
			break;
		case 'table':
			console.log(element.tableData?.rows.length);
			break;
		case 'group':
			// groups nest other elements
			walk(element.children);
			break;
	}
}
```

::: warning Always narrow before accessing
Accessing a variant-specific field (`element.imagePath`, `element.children`, …) without first checking `element.type` is a type error. Use `switch (element.type)` or `if (element.type === '…')`. There are also helper subset aliases such as `PptxElementWithText` for function signatures.
:::

See [The PptxData Model](/guide/data-model) for the full list of element types and their `type` strings.

## Theme resolution chain

A single visual property (a fill colour, a font, a size) is rarely set directly on an element. PowerPoint resolves it through a layered inheritance chain, and `pptx-viewer` mirrors that exact order:

```
Element  →  Placeholder  →  Layout  →  Master  →  Theme
```

1. **Element** — an explicit value on the element wins if present.
2. **Placeholder** — otherwise inherit from the matching placeholder.
3. **Layout** — then from the slide layout the slide is based on.
4. **Master** — then from the layout's slide master.
5. **Theme** — finally from the theme (colour scheme, font scheme).

This is why an element with no explicit colour still renders correctly: the value flows down from the theme through the master and layout. Theme colours are also exposed on the parsed data as `PptxData.themeColorMap` and the full `PptxData.theme` object.

## Slides, masters, and layouts

The presentation hierarchy has three structural levels:

- **Slide master** (`PptxSlideMaster`) — the top-level template. Defines default text styles (`txStyles`), a background, a colour map, and the set of layouts beneath it.
- **Slide layout** (`PptxSlideLayout`) — a named arrangement of placeholders (e.g. _Title Slide_, _Title and Content_) belonging to a master. A slide picks exactly one layout via its `layoutPath`.
- **Slide** (`PptxSlide`) — the actual content. Its `elements` array holds the `PptxElement`s the user authored; unspecified styling inherits up through its layout and master per the [theme resolution chain](#theme-resolution-chain).

```
PptxData
  └── slideMasters[]            (PptxSlideMaster)
        └── layouts[]           (PptxSlideLayout)
  └── slides[]                  (PptxSlide → layoutPath → a layout above)
        └── elements[]          (PptxElement union)
```

## Related reading

- [The PptxData Model](/guide/data-model) — the full type listing for `PptxData`, `PptxSlide`, and every element type.
- [Architecture](/guide/architecture) — the load/save pipelines that produce this model.

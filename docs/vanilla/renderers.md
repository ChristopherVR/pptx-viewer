---
title: Vanilla JS Element Renderers
description: Extend the zero-framework PowerPoint viewer with the element renderer registry - override or add renderers per slide element type without forking.
---

# Element Renderers

Every element on a slide is rendered by dispatching its `type` (the `PptxElement` discriminated
union from `pptx-viewer-core`) through an **element renderer registry**. The registry is an open
extension surface: hosts can override a built-in renderer or add one for a type the viewer does
not render yet, without forking the package.

## How rendering is layered

A slide render is a fixed pipeline, top to bottom:

1. **Stage** (`renderSlideStage`): a `div.pptxv-stage` sized to the unscaled slide canvas
   (`canvasSize.width x canvasSize.height` in CSS px), with the resolved slide background applied
   and the zoom applied as a CSS `transform: scale(...)` with `transform-origin: top left`.
   Renderers therefore always lay out in **unscaled canvas pixels**; they never scale themselves.
2. **Dispatch**: each `slide.elements[i]` is resolved through the registry
   (`registry.resolve(element.type)`) and called with `zIndex = i` (document order is stacking
   order). A renderer returns an `HTMLElement`, an `SVGElement`, or `null` (render nothing).
3. **Stage-boundary decoration**: on the interactive canvas (never the thumbnail rail) the stage
   marks each rendered element with `data-pptx-element="true"`, applies shared accessibility
   metadata (`role`, `aria-label`, `aria-roledescription`), and locks inherited template elements
   (`pointer-events: none`) unless template editing is enabled. Because this happens at the stage
   boundary, custom host renderers get it for free.
4. **Recursion**: the `group` renderer renders its children through `context.renderElement`, so
   overrides apply inside groups too.

The same pipeline renders the editor canvas, the thumbnail rail, the presentation stage, and the
off-screen export capture stage; they differ only in the context flags they pass (`scale`,
`interactive`, `presenting`).

## Built-in coverage

Dedicated renderers ship for every element type; only unknown extension types fall through to the
placeholder fallback:

| Element type       | Renderer module (in `render/elements/`)           |
| ------------------ | ------------------------------------------------- |
| `text`, `shape`    | `text-shape.ts` (plus `text-block.ts` helpers)    |
| `image`, `picture` | `image.ts`                                        |
| `group`            | `group.ts` (recurses via `context.renderElement`) |
| `connector`        | `connector.ts`                                    |
| `table`            | `table.ts`                                        |
| `chart`            | `chart.ts` + `chart-svg.ts`                       |
| `smartArt`         | `smartart.ts` + SVG / fallback / 3D variants      |
| `media`            | `media.ts`                                        |
| `ink`              | `ink.ts`                                          |
| `ole`              | `ole.ts`                                          |
| `model3d`          | `model3d.ts`                                      |
| `zoom`             | `zoom.ts`                                         |
| `contentPart`      | `contentpart.ts`                                  |
| _(anything else)_  | `placeholder.ts` (fallback)                       |

The fallback renders a typed placeholder box positioned exactly where the element belongs,
labelled with the element type and carrying `data-element-id` and `data-element-type` attributes.

Two context flags select renderer variants: `smartArt3D` (opt-in Three.js extruded SmartArt, see
[`PptxViewerOptions.smartArt3D`](/vanilla/options)) and `presenting` (media autoplays, Zoom tiles
navigate) are threaded through the context automatically.

## The renderer contract

```ts
import { applyStyleMap, type ElementRenderer } from 'pptx-vanilla-viewer';

const myRenderer: ElementRenderer = (element, zIndex, context) => {
	const el = context.document.createElement('div');
	applyStyleMap(el, {
		position: 'absolute',
		left: `${element.x}px`,
		top: `${element.y}px`,
		width: `${element.width}px`,
		height: `${element.height}px`,
		zIndex: String(zIndex),
	});
	el.dataset.elementId = element.id;
	// ...build the element's content...
	return el; // HTMLElement | SVGElement | null (null renders nothing)
};
```

The contract (documented on `ElementRenderer` in the source):

- **Position absolutely** within the stage from the element's `x` / `y` / `width` / `height`
  (unscaled canvas px). The built-in renderers do this with the shared `getContainerStyle`
  helper, which also handles rotation and flips. The stage scales via a CSS transform; do not
  scale yourself.
- Set `dataset.elementId = element.id` on the root node.
- Create **all** DOM via `context.document`, never the global `document`, so slides can render
  into detached documents (tests, export pipelines).
- Never mutate `element` or anything on the context.

### `ElementRenderContext`

Every renderer call receives an immutable context:

| Field                                          | What it is                                                                         |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| `document`                                     | Document used for all DOM creation.                                                |
| `slide`                                        | The slide being rendered.                                                          |
| `slides?`, `currentSlideIndex?`                | Full deck + active index, used by Zoom elements to resolve their target preview.   |
| `canvasSize`                                   | Full slide canvas size in CSS px (elements are positioned in this space).          |
| `scale`                                        | Stage render scale (1 = 100%); informational, e.g. for raster density decisions.   |
| `mediaDataUrls`                                | Archive-path to displayable-URL map for media and poster frames.                   |
| `colorScheme?`                                 | Presentation theme colour scheme for theme-aware render helpers.                   |
| `tableStyleMap?`                               | Parsed `ppt/tableStyles.xml` definitions for table band/header styling.            |
| `fieldContext?`                                | Field substitution context (slide number, date fields).                            |
| `t`                                            | Shared-dictionary translator (`pptx.*` keys).                                      |
| `smartArt3D`                                   | Opt-in WebGL SmartArt flag (mirrors the viewer option).                            |
| `presenting`                                   | True only on the live presentation stage (media autoplay, Zoom navigation).        |
| `onZoomClick?`                                 | Presentation-only Zoom tile activation callback.                                   |
| `onSmartArtNodeTextChange?` / `...FillChange?` | Inline SmartArt editing callbacks.                                                 |
| `registry`                                     | The registry in effect, for renderers that need to inspect it.                     |
| `renderElement(element, zIndex)`               | Render a child element through the registry (the group renderer's recursion hook). |

## The registry API

```ts
interface ElementRendererRegistry {
	register(type: PptxElementType, renderer: ElementRenderer): void; // add or replace
	unregister(type: PptxElementType): void; // falls back afterwards
	get(type: PptxElementType): ElementRenderer | undefined;
	has(type: PptxElementType): boolean; // dedicated (non-fallback) renderer?
	setFallback(renderer: ElementRenderer): void; // replace the placeholder fallback
	resolve(type: PptxElementType): ElementRenderer; // registered renderer or fallback
	registeredTypes(): PptxElementType[]; // sorted, for tests/debugging
}
```

`PptxElementType` is the `type` discriminant union of `PptxElement` (`'text'`, `'chart'`, ...).

## Registering

Per instance, after creation:

```ts
const viewer = createPptxViewer(host, { source });
viewer.getRegistry().register('model3d', myModel3dRenderer);
```

Or build a registry up front and pass it in:

::: code-group

```ts [Override a built-in]
import { createDefaultRegistry, createPptxViewer } from 'pptx-vanilla-viewer';

const registry = createDefaultRegistry();
registry.register('table', myTableRenderer); // overrides the built-in
const viewer = createPptxViewer(host, { source, registry });
```

```ts [Start from empty]
import { createElementRendererRegistry, createPptxViewer } from 'pptx-vanilla-viewer';

// Empty registry: no built-ins, fallback renders nothing until you set one.
const registry = createElementRendererRegistry();
registry.register('text', myTextRenderer);
registry.setFallback(myPlaceholder);
const viewer = createPptxViewer(host, { source, registry });
```

:::

## Related public exports

These package-root exports support custom renderers and headless rendering:

| Export                                   | What it is                                                                                     |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `createDefaultRegistry()`                | Registry with every built-in renderer plus the placeholder fallback.                           |
| `createElementRendererRegistry()`        | Empty registry (fallback renders nothing).                                                     |
| `renderSlideStage(options)`              | Render one slide to a detached stage element (`SlideStageOptions`): the headless render entry. |
| `applyStyleMap(el, style)`               | Apply a shared `CssStyleMap` (camelCase or kebab-case keys) to an element.                     |
| `createEl(doc, tag, className?, style?)` | Create an element with optional class + style map through an explicit `Document`.              |
| `createSvgEl(doc, tag, attrs?)`          | Create a namespaced SVG element with optional attributes.                                      |

`renderSlideStage` returns a node laid out at the unscaled canvas size and scaled on screen via
CSS transform, so wrap it in a box sized to `canvasSize * scale` (the viewer's stage host and
thumbnails both do).

## Notes

- Re-render happens automatically on navigation, zoom, theme, and locale changes; registry
  changes apply from the next render (navigate or call `goToSlide(getCurrentSlide())` to force).
- Reuse `pptx-viewer-shared` helpers rather than reimplementing geometry/style math; the
  built-in renderers in
  [`packages/vanilla/src/viewer/render/elements/`](https://github.com/ChristopherVR/pptx-viewer/tree/main/packages/vanilla/src/viewer/render/elements)
  are the reference implementations, and their `README.md` documents the house contract.

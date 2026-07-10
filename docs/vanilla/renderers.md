---
title: Vanilla JS Element Renderers
description: Extend the zero-framework PowerPoint viewer with the element renderer registry - override or add renderers per slide element type without forking.
---

# Element Renderers

Every element on a slide is rendered by dispatching its `type` (the `PptxElement` discriminated
union from `pptx-viewer-core`) through an **element renderer registry**. The registry is an open
extension surface: hosts can override a built-in renderer or add one for a type the viewer does
not render yet, without forking the package.

## Built-in coverage

Dedicated renderers ship for `text`, `shape`, `image`, `picture`, `group`, `connector`,
`table`, `chart`, `smartArt` (2D), `media`, `ink`, and `ole`. The remaining types
(`contentPart`, `zoom`, `model3d`, `unknown`) fall through to a typed placeholder box that
carries `data-element-id` and `data-element-type` attributes.

## The renderer contract

```ts
import type { ElementRenderer } from 'pptx-vanilla-viewer';

const myRenderer: ElementRenderer = (element, zIndex, context) => {
	// context: document, slide, canvasSize, scale, mediaDataUrls, t (i18n), registry
	const el = context.document.createElement('div');
	el.dataset.elementId = element.id;
	el.style.zIndex = String(zIndex);
	// position/size the element yourself or via the shared container style
	return el; // HTMLElement | SVGElement | null (null renders nothing)
};
```

Renderers receive the raw element, its stacking order, and an `ElementRenderContext` with
everything needed to build DOM: the active document (so detached documents work), the slide
and canvas size, the stage scale, media data URLs prepared by the load pipeline, the
translator, and the registry itself (used by the `group` renderer to recurse).

## Registering

Per instance, after creation:

```ts
const viewer = createPptxViewer(host, { source });
viewer.getRegistry().register('model3d', myModel3dRenderer);
```

Or build a registry up front and pass it in:

```ts
import { createDefaultRegistry } from 'pptx-vanilla-viewer';

const registry = createDefaultRegistry();
registry.register('table', myTableRenderer); // overrides the built-in
const viewer = createPptxViewer(host, { source, registry });
```

`registry.unregister(type)` drops a renderer back to the placeholder fallback;
`registry.registeredTypes()` lists current dedicated registrations.

## Notes

- Re-render happens automatically on navigation, zoom, theme, and locale changes; registry
  changes apply from the next render (navigate or call `goToSlide(getCurrentSlide())` to force).
- Reuse `pptx-viewer-shared` helpers rather than reimplementing geometry/style math; the
  built-in renderers in
  [`packages/vanilla/src/viewer/render/elements/`](https://github.com/ChristopherVR/pptx-viewer/tree/main/packages/vanilla/src/viewer/render/elements)
  are the reference implementations, and their `README.md` documents the house contract.

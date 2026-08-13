---
title: Getting Started
description: Mount a pptx-vanilla-viewer into a container, load a .pptx from a URL or file input, navigate slides, and enter presentation mode - no framework required.
---

# Getting Started

This page walks from an empty `<div>` to a working viewer with file loading, navigation, and
presentation mode.

::: tip Prerequisites
Install the package first, see [Overview > Installation](/vanilla/#installation).
:::

## 1. Mount a viewer

`createPptxViewer(container, options)` builds the viewer chrome inside `container` and returns a
[`PptxViewerInstance`](/vanilla/api). The viewer fills its container, so give the container an
explicit size.

```html
<div id="host" style="height: 100vh"></div>
```

```ts
import { createPptxViewer } from 'pptx-vanilla-viewer';

const viewer = createPptxViewer(document.getElementById('host')!, {
	source: '/presentation.pptx',
	onLoad: ({ slideCount, canvasSize }) => {
		console.log(`${slideCount} slides at ${canvasSize.width}x${canvasSize.height}`);
	},
	onError: (message) => console.error(message),
});
```

`source` accepts a **URL string** (fetched for you), an **`ArrayBuffer`**, a **`Uint8Array`**, or a
**`Blob`/`File`**. Omit it to start empty and load later.

## 2. Loading from a file `<input>`

```html
<input type="file" id="file" accept=".pptx,.ppt" />
<div id="host" style="height: 80vh"></div>
```

```ts
import { createPptxViewer } from 'pptx-vanilla-viewer';

const viewer = createPptxViewer(document.getElementById('host')!, {
	onSlideChange: (index) => console.log('slide', index + 1),
});

document.getElementById('file')!.addEventListener('change', async (e) => {
	const file = (e.target as HTMLInputElement).files?.[0];
	if (file) {
		await viewer.loadFile(file); // Blob | ArrayBuffer | Uint8Array
	}
});
```

`loadFile` and `loadUrl` replace the current presentation; the `onLoad` callback fires again for
each successful load.

## 3. Navigation, zoom, and presentation

All toolbar operations are also available as instance methods:

```ts
viewer.next();
viewer.prev();
viewer.goToSlide(3); // zero-based, clamped

viewer.setZoom(1.5); // explicit scale (1 = 100%)
viewer.setZoom('fit'); // fit-to-viewport
viewer.zoomIn();
viewer.zoomOut();
viewer.zoomToFit();

await viewer.enterPresentation(); // real Fullscreen API; Esc exits
await viewer.exitPresentation();
```

See [Viewer Instance API](/vanilla/api) for the complete method reference, and
[Options & Callbacks](/vanilla/options) for `showToolbar` / `showThumbnails` if you want to hide the
built-in chrome and drive everything yourself.

## Keyboard support

The viewer root is focusable (`tabindex="0"`). With focus on the viewer:

| Keys                                 | Action                 |
| ------------------------------------ | ---------------------- |
| Arrow keys, PageUp / PageDown, Space | Previous / next slide  |
| Home / End                           | First / last slide     |
| Esc                                  | Exit presentation mode |

## Styling / required CSS

No CSS import is required: the stylesheet is injected once per document as a
`<style id="pptx-vanilla-viewer-styles">` tag when the first viewer is created, scoped under the
`.pptxv` root class. Creating more viewers reuses the same tag.

### CSP-strict hosts: `getViewerCss` {#csp-strict-hosts-getviewercss}

If your Content Security Policy forbids injected style tags, import the packaged
static stylesheet:

```ts
import 'pptx-vanilla-viewer/styles.css';
```

Alternatively, render the stylesheet text yourself. Automatic injection is a
no-op once a node with the viewer style id exists:

```ts
import { getViewerCss } from 'pptx-vanilla-viewer';

// e.g. server-side, or in your build:
const style = document.createElement('style');
style.id = 'pptx-vanilla-viewer-styles';
style.textContent = getViewerCss();
document.head.appendChild(style);
```

All chrome colours come from `--pptx-*` CSS custom properties; see [Theming](/vanilla/theming) to
override them.

## Localization

UI strings resolve through the shared `pptx.*` dictionary (English built in). Pass per-locale
overrides via the `messages` option plus `locale` (or call `setLocale` later); missing keys fall
back to English, then to a humanised label:

```ts
const viewer = createPptxViewer(host, {
	source,
	locale: 'de',
	messages: {
		de: { 'pptx.presenter.nextSlide': 'Nächste Folie' /* ... */ },
	},
});

viewer.setLocale('en'); // rebuilds the chrome labels
```

## Cleanup

Call `destroy()` when the viewer's host is removed - it tears down the DOM, event listeners, Blob
URLs, and the core handler:

```ts
viewer.destroy();
```

## Next steps

- [Options & Callbacks](/vanilla/options) - every option in detail.
- [Viewer Instance API](/vanilla/api) - the full instance method reference.
- [Element Renderers](/vanilla/renderers) - extend rendering for more element types.

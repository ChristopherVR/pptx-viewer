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

## 1. Create a complete app

The quickest reliable setup uses Vite. Create a folder with this exact structure, then put the
PowerPoint file you want to open in `public/presentation.pptx`:

```text
my-pptx-app/
  index.html
  package.json
  public/
    presentation.pptx
  src/
    main.js
```

Install the package and Vite:

```bash
npm init -y
npm install pptx-vanilla-viewer
npm install -D vite
```

Set the `scripts` entry in `package.json` to:

```json
{
	"scripts": {
		"dev": "vite"
	}
}
```

Then run `npm run dev` and open the local URL Vite prints. Vite serves files in `public/` from
the site root, so `public/presentation.pptx` is available as `/presentation.pptx`.

### `index.html`

```html
<!doctype html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>PPTX Viewer</title>
		<style>
			html,
			body,
			#host {
				height: 100%;
				margin: 0;
			}
		</style>
	</head>
	<body>
		<div id="host"></div>
		<script type="module" src="/src/main.js"></script>
	</body>
</html>
```

### `src/main.js`

```js
import { createPptxViewer, vermilionDarkTheme } from 'pptx-vanilla-viewer';

const host = document.getElementById('host');

createPptxViewer(host, {
	// This is served from public/presentation.pptx by Vite.
	source: '/presentation.pptx',
	theme: vermilionDarkTheme,
	editable: true,
	showToolbar: true,
	showThumbnails: true,
	fileName: 'presentation.pptx',
	onLoad: ({ slideCount }) => console.log(`Loaded ${slideCount} slides`),
	onError: (message) => console.error(message),
});
```

When `source` loads successfully, the viewer now opens the presentation automatically. Do not
query or click the viewer's internal Backstage controls from `onLoad`.

If you host a `.pptx` on another domain instead, that server must permit your site with CORS. A
file in `public/` avoids that requirement while developing.

## 2. Mount a viewer

`createPptxViewer(container, options)` builds the viewer chrome inside `container` and returns a
[`PptxViewerInstance`](/vanilla/api). The viewer fills its container, so give the container an
explicit size.

```html
<div id="host" style="height: 100vh"></div>
```

```js
import { createPptxViewer } from 'pptx-vanilla-viewer';

const host = document.getElementById('host');
if (!host) throw new Error('Missing #host element');

const viewer = createPptxViewer(host, {
	source: '/presentation.pptx',
	onLoad: ({ slideCount, canvasSize }) => {
		console.log(`${slideCount} slides at ${canvasSize.width}x${canvasSize.height}`);
	},
	onError: (message) => console.error(message),
});
```

`source` accepts a **URL string** (fetched for you), an **`ArrayBuffer`**, a **`Uint8Array`**, or a
**`Blob`/`File`**. Omit it to start empty and load later.

## 3. Loading from a file `<input>`

```html
<input type="file" id="file" accept=".pptx,.ppt" />
<div id="host" style="height: 80vh"></div>
```

```js
import { createPptxViewer } from 'pptx-vanilla-viewer';

const host = document.getElementById('host');
const fileInput = document.getElementById('file');
if (!host || !(fileInput instanceof HTMLInputElement)) {
	throw new Error('Missing #host or #file element');
}

const viewer = createPptxViewer(host, {
	onSlideChange: (index) => console.log('slide', index + 1),
});

fileInput.addEventListener('change', async (event) => {
	const file = event.currentTarget.files?.[0];
	if (file) {
		await viewer.loadFile(file); // Blob | ArrayBuffer | Uint8Array
	}
});
```

`loadFile` and `loadUrl` replace the current presentation; the `onLoad` callback fires again for
each successful load.

## 4. Navigation, zoom, and presentation

All toolbar operations are also available as instance methods:

```ts
viewer.next();
viewer.prev();
viewer.goToSlide(3); // zero-based, clamped

viewer.setZoom(1.5); // explicit scale (1 = 100%)
viewer.zoomToFit(); // fit-to-viewport
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

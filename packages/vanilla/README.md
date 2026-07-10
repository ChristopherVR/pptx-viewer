# pptx-vanilla-viewer

> ### ⚠️ Viewing capability only
>
> This release provides **read-only / viewing** of `.pptx` files.
> Editing, saving, and authoring features are **not available** in this
> version and will be added in a future release.
>
> The package is under active development and the API may change.
> For the latest source, roadmap, and issue tracker visit:
>
> **https://github.com/ChristopherVR/pptx-viewer**

Zero-framework PowerPoint viewer: render `.pptx` slides in the browser with
plain DOM. No React, Vue, or Angular required; the parsing engine
(`pptx-viewer-core`) and the shared render logic (`pptx-viewer-shared`) are
bundled in.

```bash
npm install pptx-vanilla-viewer jszip fast-xml-parser
```

## Usage

```ts
import { createPptxViewer } from 'pptx-vanilla-viewer';

const viewer = createPptxViewer(document.getElementById('host')!, {
	source: '/decks/quarterly.pptx', // URL, ArrayBuffer, Uint8Array, Blob, or File
	theme: { colors: { primary: '#e34f26' } },
	locale: 'en',
	initialSlide: 0,
	showToolbar: true,
	showThumbnails: true,
	onLoad: ({ slideCount }) => console.log(`${slideCount} slides`),
	onSlideChange: (index) => console.log('slide', index + 1),
	onError: (message) => console.error(message),
});

// Navigation / zoom
viewer.next();
viewer.prev();
viewer.goToSlide(3);
viewer.setZoom(1.5); // or 'fit'
viewer.zoomToFit();

// Presentation mode (real Fullscreen API; Esc exits)
await viewer.enterPresentation();

// Load a different file later
await viewer.loadFile(fileInput.files![0]);
await viewer.loadUrl('/other-deck.pptx');

// Escape hatch: the live pptx-viewer-core handler (save, markdown, archive access)
const handler = viewer.getHandler();

// Tear down DOM, listeners, Blob URLs, and the core handler
viewer.destroy();
```

The container should have a size (the viewer fills it: `width/height: 100%`).

## Keyboard

Arrow keys / PageUp / PageDown / Space navigate, Home/End jump to the first or
last slide, Esc exits presentation mode. The viewer root is focusable
(`tabindex="0"`).

## Styling and theming

Styles are injected once per document as a `<style id="pptx-vanilla-viewer-styles">`
tag, scoped under the `.pptxv` root class. Hosts with a strict CSP can render
the stylesheet themselves via `getViewerCss()` (the injection is a no-op once
a node with that id exists).

All chrome colors come from the shared `--pptx-*` CSS custom properties. Pass
a `ViewerTheme` (`theme` option or `setTheme`) to override them; the
`vermilionLightTheme` / `vermilionDarkTheme` presets are re-exported.

## i18n

All UI strings go through the shared `pptx.*` dictionary (English built in).
Provide `messages: { de: { 'pptx.presenter.nextSlide': 'Nächste Folie', ... } }`
plus `locale: 'de'` (or call `setLocale`) for other languages; missing keys
fall back to English, then to a humanised label.

## Element coverage

Dedicated renderers: text, shape, image/picture, group, connector. All other
element types (table, chart, SmartArt, media, ink, OLE, ...) currently render
a typed placeholder box. Renderers are dispatched through an open registry, so
coverage can be extended without forking:

```ts
import { createPptxViewer, type ElementRenderer } from 'pptx-vanilla-viewer';

const renderTable: ElementRenderer = (element, zIndex, context) => {
	/* build and return a DOM node */
};

const viewer = createPptxViewer(host, { source });
viewer.getRegistry().register('table', renderTable);
```

See `src/viewer/render/elements/README.md` for the full renderer contract.

## License

Apache-2.0. See `LICENSE` and `NOTICE`.

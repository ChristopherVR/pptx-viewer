# pptx-vanilla-viewer

[![npm version](https://img.shields.io/npm/v/pptx-vanilla-viewer.svg)](https://www.npmjs.com/package/pptx-vanilla-viewer)
[![license](https://img.shields.io/npm/l/pptx-vanilla-viewer.svg)](https://github.com/ChristopherVR/pptx-viewer/blob/main/LICENSE)

Show, edit, and present Microsoft PowerPoint (`.pptx`) files directly in the
browser with **zero framework**: no React, Vue, Angular, or Svelte required, no
server, no conversion step, no PowerPoint install. Call one factory function,
`createPptxViewer(container, options)`, and slides render as real HTML and
CSS.

![Editing, undoing, and rendering a deck with the zero-framework Vanilla JavaScript demo](https://raw.githubusercontent.com/ChristopherVR/pptx-viewer/main/.github/assets/packages/vanilla-demo.gif)

The rendering is done by the framework-agnostic [`pptx-viewer-core`](https://www.npmjs.com/package/pptx-viewer-core) engine, which turns a `.pptx` file into a structured slide model. This package is the plain-DOM layer that draws that model on screen, and the engine is **bundled in**, so you install just one package.

<samp>**[▶️ Try the live demo](https://christophervr.github.io/pptx-viewer/demo-vanilla/)** · **[📦 npm](https://www.npmjs.com/package/pptx-vanilla-viewer)** · **[📖 Full docs](https://christophervr.github.io/pptx-viewer/vanilla/)** · **[🧩 Core SDK](https://www.npmjs.com/package/pptx-viewer-core)**</samp>

## Install

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
	editable: true, // select, drag, resize, rotate, inline text, undo/redo, save
	showToolbar: true,
	showThumbnails: true,
	onLoad: ({ slideCount }) => console.log(`${slideCount} slides`),
	onSlideChange: (index) => console.log('slide', index + 1),
	onError: (message) => console.error(message),
	onDirtyChange: (dirty) => console.log('unsaved edits:', dirty),
});

// Navigation / zoom
viewer.next();
viewer.prev();
viewer.goToSlide(3);
viewer.setZoom(1.5); // or 'fit'
viewer.zoomToFit();

// Presentation mode (real Fullscreen API; Esc exits)
await viewer.enterPresentation();

// Editing (click/drag/resize/rotate/double-click-to-edit-text happen via the
// DOM; these are the programmatic entry points)
viewer.undo();
viewer.redo();
viewer.deleteSelected();
const bytes = await viewer.save(); // serialise the edited deck to .pptx bytes
await viewer.downloadPptx('quarterly-edited.pptx'); // save() + trigger a download

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

Navigation: arrow keys / PageUp / PageDown / Space, Home/End jump to the
first or last slide, Esc exits presentation mode. The viewer root is
focusable (`tabindex="0"`).

When `editable` is on and an element is selected: Ctrl/Cmd+Z undoes,
Ctrl/Cmd+Shift+Z (or Ctrl+Y) redoes, Delete/Backspace deletes the selection,
Ctrl/Cmd+D duplicates it, arrow keys nudge it by 1px (Shift+arrow for 10px),
and Escape deselects. Double-click a text-capable element to edit its text
inline.

## Styling and theming

Styles are injected once per document as a `<style id="pptx-vanilla-viewer-styles">`
tag, scoped under the `.pptxv` root class. CSP-strict hosts can import the
packaged static stylesheet with `import 'pptx-vanilla-viewer/styles.css'`.
`getViewerCss()` remains available when the host needs the stylesheet text.

All chrome colors come from the shared `--pptx-*` CSS custom properties. Pass
a `ViewerTheme` (`theme` option or `setTheme`) to override them; the
`vermilionLightTheme` / `vermilionDarkTheme` presets are re-exported.

## Editing

Pass `editable: true` (or call `setEditable(true)` at runtime) to turn on:

- Click to select an element, click empty space to deselect.
- Drag to move, with snap-to-sibling-edge guides.
- Resize via 8 handles (Shift locks aspect ratio on the corner handles) and
  rotate via a rotate handle (Shift snaps to angle increments).
- Double-click a text-capable element for inline text editing.
- Undo/redo (100-entry history), delete, and duplicate (`Ctrl/Cmd+D`).
- Insert, format, z-order, group, and ungroup elements from the ribbon.
- Edit inherited master/layout elements by enabling template editing in the
  View ribbon or calling `setEditTemplateMode(true)`.
- Rich speaker notes, accessibility checks, autosave, and collaboration.
- The toolbar's Save button (shown only when `editable`), which calls
  `downloadPptx()` to serialise and download the edited `.pptx`.

For CSP-strict hosts, import `pptx-vanilla-viewer/styles.css` instead of using
automatic style injection.

Use `viewer.getSelectedElementId()` and the `onSelectionChange` /
`onDirtyChange` callbacks to build your own chrome around the selection
state.

## i18n

All UI strings go through the shared `pptx.*` dictionary (English built in).
Provide `messages: { de: { 'pptx.presenter.nextSlide': 'Nächste Folie', ... } }`
plus `locale: 'de'` (or call `setLocale`) for other languages; missing keys
fall back to English, then to a humanised label.

## Element coverage

Dedicated renderers ship for every element type: text, shape, image/picture,
group, connector, table, chart, SmartArt (2D and opt-in 3D), media
(video/audio), ink, OLE, content parts, zoom links, and 3D models. Renderers
are dispatched through an open registry, so any of them can be overridden
without forking:

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

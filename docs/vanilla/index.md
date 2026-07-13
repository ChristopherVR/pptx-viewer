---
title: Vanilla JS Viewer Overview
description: pptx-vanilla-viewer is a zero-framework PowerPoint viewer for the browser - render .pptx slides with plain DOM, no React, Vue, or Angular required.
---

# Vanilla JS Viewer Overview

`pptx-vanilla-viewer` is a **zero-framework** PowerPoint viewer: it renders `.pptx` slides in the
browser with plain DOM. There is no React, Vue, or Angular in sight - you call one factory function,
`createPptxViewer(container, options)`, and get back a viewer instance with an imperative API. The
parsing engine ([`pptx-viewer-core`](/core/)) and the shared render logic (`pptx-viewer-shared`) are
bundled in, so the package is self-contained.

Try it live: the [vanilla demo](https://christophervr.github.io/pptx-viewer/demo-vanilla/) is this
package running with no framework at all.

## What it provides

| Capability          | Summary                                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Slide rendering** | Text, shapes, images, groups, connectors, tables, charts, SmartArt (2D and opt-in 3D), media, ink, OLE, content parts, zoom links, and 3D models all render with dedicated renderers. |
| **Navigation**      | Toolbar, thumbnail sidebar, keyboard navigation (arrows, PageUp/PageDown, Space, Home/End), speaker-notes panel.                                                                      |
| **Presentation**    | Fullscreen presentation mode via the real Fullscreen API (Esc exits), with media autoplay.                                                                                            |
| **Theming**         | The shared `ViewerTheme` system (`--pptx-*` CSS custom properties), including the vermilion presets. See [Theming](/vanilla/theming).                                                 |
| **Editing**         | Behind `editable`: insert, format, multi-select/group, arrange, inherited template editing, rich notes, undo/redo, and save/download. See [Instance API](/vanilla/api).               |
| **Export**          | PNG, PDF, GIF, video, print, notes-page, and handout output.                                                                                                                          |
| **Accessibility**   | Element semantics plus a presentation-wide accessibility checker with issue navigation.                                                                                               |
| **Extensibility**   | An open element-renderer registry: register or override renderers per element type without forking. See [Element Renderers](/vanilla/renderers).                                      |

::: info Element coverage
For a precise list of what the underlying parser supports, and what is approximated, see
[Limitations](/guide/limitations).
:::

## Installation

```bash
npm i pptx-vanilla-viewer jszip fast-xml-parser
```

The core engine (`pptx-viewer-core`) and shared render layer are **bundled in**; the only peer
dependencies are `jszip` and `fast-xml-parser`. There are no framework peers and no optional peers -
what you install is everything the viewer needs.

## Quick example

```ts
import { createPptxViewer } from 'pptx-vanilla-viewer';

const viewer = createPptxViewer(document.getElementById('host')!, {
	source: '/decks/quarterly.pptx', // URL, ArrayBuffer, Uint8Array, Blob, or File
	onLoad: ({ slideCount }) => console.log(`${slideCount} slides`),
});

viewer.next();
viewer.goToSlide(3);
await viewer.enterPresentation();
```

The container should have a size; the viewer fills it (`width/height: 100%`). See
[Getting Started](/vanilla/getting-started) for the full walkthrough.

## No build step required

The package ships ESM and CJS builds. Because there is no framework, it also works from a plain
`<script type="module">` with an import map or a bundler-free CDN setup - anywhere modern
JavaScript runs. Styles are injected automatically at construction time (a single
`<style id="pptx-vanilla-viewer-styles">` tag, scoped under the `.pptxv` root class); CSP-strict
hosts can render the stylesheet themselves via [`getViewerCss()`](/vanilla/getting-started#csp-strict-hosts-getviewercss).

## Rendering philosophy: CSS, not Canvas

Like every binding in this monorepo, slides render as **CSS-positioned HTML/SVG** scaled with a CSS
transform, not onto a Canvas. Text stays selectable and crisp at any zoom, and screen readers keep
working. The tradeoffs are listed in [Limitations](/guide/limitations).

## Key exports

| Export                                       | Kind     | Purpose                                                                                    |
| -------------------------------------------- | -------- | ------------------------------------------------------------------------------------------ |
| `createPptxViewer`                           | function | Factory: mount a viewer into a container. See [Getting Started](/vanilla/getting-started). |
| `PptxViewerOptions`, `PptxViewerCallbacks`   | type     | Options and event callbacks. See [Options & Callbacks](/vanilla/options).                  |
| `PptxViewerInstance`                         | type     | The returned handle. See [Viewer Instance API](/vanilla/api).                              |
| `PptxViewerSource`                           | type     | `ArrayBuffer \| Uint8Array \| Blob \| string` (URL).                                       |
| `ElementRenderer`, `ElementRendererRegistry` | type     | Renderer extension surface. See [Element Renderers](/vanilla/renderers).                   |
| `createDefaultRegistry`                      | function | The default renderer registry (all built-in renderers pre-registered).                     |
| `getViewerCss`                               | function | The full stylesheet as a string, for CSP-strict hosts.                                     |
| `ViewerTheme`, `ViewerThemeColors`           | type     | Theme configuration types. See [Theming](/vanilla/theming).                                |
| `vermilionLightTheme`, `vermilionDarkTheme`  | const    | Built-in vermilion light/dark presets.                                                     |
| `themeToCssVars`, `defaultCssVars`           | function | Convert a theme to `--pptx-*` CSS vars.                                                    |
| `PptxHandler`, `PptxSlide`, `PptxElement`    | type     | Core types re-exported for the `getHandler()` escape hatch.                                |

## Next steps

- [Getting Started](/vanilla/getting-started) - mount, load, navigate, present.
- [Options & Callbacks](/vanilla/options) - the complete `PptxViewerOptions` reference.
- [Viewer Instance API](/vanilla/api) - every method on the returned instance.
- [Theming](/vanilla/theming) - colours, radius, CSS vars, vermilion presets.
- [Element Renderers](/vanilla/renderers) - extend or override slide rendering.

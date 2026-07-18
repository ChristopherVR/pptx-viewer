---
title: Angular Viewer Overview
description: pptx-angular-viewer is an Angular standalone component for viewing, editing, presenting, exporting, and collaboratively editing PowerPoint (.pptx) files in the browser.
---

# Angular Viewer Overview

`pptx-angular-viewer` is an **Angular 22** standalone component (`<pptx-viewer>`) for rendering
and editing `.pptx` files. It is built on [`pptx-viewer-core`](/core/) and includes the ribbon
toolbar, inspector panels, slide canvas, animation engine, presentation mode, real-time
collaboration, and export. It is the Angular
counterpart of `pptx-react-viewer` and `pptx-vue-viewer`, sharing framework-agnostic logic with both
through the internal `pptx-viewer-shared` package.

![The editor chrome is identical across bindings: ribbon, slide thumbnails, canvas, and inspector](/docs-shots/editor.jpg)

## What it provides

| Capability         | Summary                                                                                                                                         |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Viewer**         | Renders slides with 16 element types (shapes, text, images, tables, charts, SmartArt, connectors, media, ink, OLE, 3D models, zoom).            |
| **WYSIWYG editor** | Insert / move / resize / delete elements, inline text editing, style editing, slide management - gated behind `canEdit`.                        |
| **Presenter**      | Fullscreen slideshow with animation playback, transitions, speaker notes, presenter view with timer, and a mobile presenter layout.             |
| **Export**         | PNG / PDF / GIF / WebM video slide export, print, plus Save As `.pptx`. See [Export](/angular/export).                                          |
| **Collaboration**  | Real-time multi-user editing via Yjs CRDT with presence tracking, remote cursors, and follow mode. See [Collaboration](/angular/collaboration). |

::: info Element coverage
For a precise list of what the underlying parser/serializer supports - and what is approximated -
see [Limitations](/guide/limitations).
:::

## Installation

```bash
npm i pptx-angular-viewer
```

The core engine (`pptx-viewer-core`) is **bundled in**, so you don't install it separately.

**Peer dependencies** (you provide these in your app):

- `@angular/core` ^22, `@angular/common` ^22
- `rxjs` ^7
- `@ngx-translate/core` ^18

**Optional peer dependencies** (only needed for specific features):

- `three` - GLB/GLTF 3D models and the opt-in 3D SmartArt renderer
- `yjs` plus `y-websocket` (server-based) or `y-webrtc` (serverless peer-to-peer) - real-time
  collaboration

::: tip
3D and collaboration features degrade gracefully. Without `three`, 3D models fall back to their
poster image. Without `yjs`/`y-websocket`/`y-webrtc`, the viewer runs in single-user mode.
:::

## Import paths

Unlike React (`pptx-react-viewer` + `pptx-react-viewer/viewer`), Angular's ng-packagr build produces
a **single entry point**: everything is imported from the package root.

```ts
import { PowerPointViewerComponent } from 'pptx-angular-viewer';
```

The `./styles` subpath exports the bundled stylesheet (see [Getting Started](/angular/getting-started)),
and that is the only other export map entry - there is no separate `/viewer` or `/i18n` subpath the
way React and Vue have. `translationsEn`, `keyToLabel`, theme utilities, and every other named export
all live at the package root; see [Localization](/guide/localization) for the i18n specifics.

## Rendering philosophy: CSS, not Canvas

Slides are rendered with **CSS positioning and transforms** (scaled HTML/SVG), not an HTML Canvas.
This provides:

- Crisp text at any zoom level
- Native browser text selection and accessibility
- DOM-based interaction (click, drag, resize hit-testing)
- Standard CSS effects (shadows, gradients, borders)

The tradeoff is that some visual effects are approximated (`backdrop-filter`, `mix-blend-mode`, CSS
3D, path gradients). Raster export goes through `html2canvas-pro`, which has its own constraints. The
full list lives in [Limitations](/guide/limitations).

## Internal architecture: services and standalone components

`PowerPointViewerComponent` is a thin, `OnPush`, signal-driven orchestrator. Its logic is decomposed
into roughly two dozen `@Injectable` orchestration services (provided on the component and wired
together with `inject()` and a `bind()` handoff pattern) plus 100+ standalone child components and
pure helper functions, mirroring React's 67+ internal hooks and Vue's composables. Most of these are
internal architecture, but a curated subset is re-exported from the package root for building custom
UI around the viewer. See [Services](/angular/services) for which are public API.

## Key exports

| Export                                           | Kind                 | Purpose                                                                                              |
| ------------------------------------------------ | -------------------- | ---------------------------------------------------------------------------------------------------- |
| `PowerPointViewerComponent`                      | standalone component | The main viewer/editor component (`pptx-viewer` selector).                                           |
| `LoadContentService`, `ExportService`, ...       | services             | Curated orchestration services also usable outside the component. See [Services](/angular/services). |
| `ViewerTheme`, `ViewerThemeColors`               | types                | Theme configuration types. See [Theming](/angular/theming).                                          |
| `provideViewerTheme`, `VIEWER_THEME`             | provider/token       | App-wide theme sharing via Angular DI.                                                               |
| `defaultThemeColors`, `defaultRadius`            | const                | Built-in dark-theme defaults.                                                                        |
| `vermilionLightTheme`, `vermilionDarkTheme`      | const                | Ready-made light/dark theme presets.                                                                 |
| `themeToCssVars`, `defaultCssVars`, `themeStyle` | function             | Convert a theme to `--pptx-*` CSS vars / an `[ngStyle]` map.                                         |
| `translationsEn`, `keyToLabel`, `TranslationKey` | const/function/type  | English i18n dictionary and fallback-label helper. See [Localization](/guide/localization).          |
| `renderToCanvas`                                 | function             | Render a DOM element to a Canvas with an oklch-colour workaround.                                    |

## Next steps

- [Getting Started](/angular/getting-started) - a minimal working example.
- [Component Inputs & Outputs](/angular/props) - the complete `@Input()`/`@Output()` reference.
- [Public API](/angular/api) - the methods exposed on the component instance.
- [Theming](/angular/theming) - colours, radius, CSS vars, DI provider.
- [Services](/angular/services) - architecture and the public service surface.
- [Export](/angular/export) - PNG/PDF/GIF/video and the html2canvas-pro pipeline.
- [Collaboration](/angular/collaboration) - Yjs co-editing and presence.

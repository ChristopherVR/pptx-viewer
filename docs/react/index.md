---
title: React Viewer Overview
description: pptx-viewer is a full-featured React component for viewing, editing, presenting, exporting, and collaboratively editing PowerPoint (.pptx) files in the browser.
---

# React Viewer Overview

`pptx-viewer` is a drop-in **React 19** component that turns raw `.pptx` bytes into a fully
interactive PowerPoint experience. It is built on top of [`pptx-viewer-core`](/core/) and bundles a
complete UI: toolbar, inspector panels, slide canvas, animation engine, presentation mode,
real-time collaboration, and export.

## What it provides

| Capability         | Summary                                                                                                                                      |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Viewer**         | Renders slides with 16 element types (shapes, text, images, tables, 23 chart types, SmartArt, connectors, media, ink, OLE, 3D models, zoom). |
| **WYSIWYG editor** | Insert / move / resize / delete elements, inline text editing, style editing, slide management — gated behind `canEdit`.                     |
| **Presenter**      | Fullscreen slideshow with 40+ animations, 42 transitions (including morph), speaker notes, presenter view with timer.                        |
| **Export**         | PNG / JPEG / SVG / PDF / GIF / video slide export, plus save-as PPTX. See [Export](/react/export).                                           |
| **Collaboration**  | Real-time multi-user editing via Yjs CRDT with presence tracking, remote cursors, and avatars. See [Collaboration](/react/collaboration).    |

::: info Element coverage
For a precise list of what the underlying parser/serializer supports — and what is approximated —
see [Limitations](/guide/limitations).
:::

## Installation

```bash
npm i pptx-viewer pptx-viewer-core
```

`pptx-viewer` depends on `pptx-viewer-core` (declared as a `workspace:*`/bundled dependency, but it is
the framework-agnostic engine you may also use directly).

**Peer dependencies** (you provide these in your app):

- `react` and `react-dom` ^19
- `framer-motion`, `lucide-react`, `react-icons`
- `jspdf`, `jszip`, `fast-xml-parser`
- `i18next`, `react-i18next`

**Optional dependencies** (only needed for specific features):

- `three`, `@react-three/fiber`, `@react-three/drei` — GLB/GLTF 3D models and 3D surface charts
- `yjs`, `y-websocket` — real-time collaboration

::: tip
3D and collaboration features degrade gracefully. Without `three`, 3D models fall back to their
poster image. Without `yjs`/`y-websocket`, the viewer runs in single-user mode.
:::

## Import paths

The package exposes two entry points (from `package.json` `exports`):

```tsx
// Root entry — viewer, theme utilities, renderToCanvas
import { PowerPointViewer } from 'pptx-react-viewer';

// Viewer sub-entry — same component PLUS the opt-in hooks/components surface
import { PowerPointViewer } from 'pptx-react-viewer/viewer';
```

Both entries export `PowerPointViewer`. The `pptx-viewer/viewer` entry additionally exposes the
opt-in, tree-shakeable hooks and collaboration components (see [Hooks](/react/hooks)). Use the root
entry for the common case.

## Rendering philosophy: CSS, not Canvas

Slides are rendered with **CSS positioning and transforms** (scaled HTML/SVG), not an HTML Canvas.
This buys:

- Crisp text at any zoom level
- Native browser text selection and accessibility
- DOM-based interaction (click, drag, resize hit-testing)
- Standard CSS effects (shadows, gradients, borders)

The tradeoff is that some visual effects are approximated (`backdrop-filter`, `mix-blend-mode`, CSS
3D, path gradients). Raster export goes through `html2canvas`, which has its own constraints. The
full list lives in [Limitations](/guide/limitations).

## Hooks-based architecture

The component is a `forwardRef` orchestrator. Its logic is decomposed into **67+ custom hooks**
composed inside `PowerPointViewer.tsx`; the visual components are almost purely presentational. Most
hooks are internal architecture, but a curated, tree-shakeable subset is exported from
`pptx-viewer/viewer` for advanced integrations. See [Hooks](/react/hooks) for which are public API.

## Key exports

| Export                                  | Kind          | Purpose                                                                                        |
| --------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------- |
| `PowerPointViewer`                      | component     | The main viewer/editor component.                                                              |
| `PowerPointViewerProps`                 | type          | Props interface. See [Props](/react/props).                                                    |
| `PowerPointViewerHandle`                | type          | Imperative ref API. See [Handle](/react/handle).                                               |
| `renderToCanvas`                        | function      | Render a DOM element to a Canvas with an oklch-colour workaround. See [Export](/react/export). |
| `getAnimationInitialStyle`              | function      | Compute the pre-animation initial CSS for an animation preset.                                 |
| `ViewerTheme`, `ViewerThemeColors`      | type          | Theme configuration types. See [Theming](/react/theming).                                      |
| `defaultThemeColors`, `defaultRadius`   | const         | Built-in dark-theme defaults.                                                                  |
| `themeToCssVars`, `defaultCssVars`      | function      | Convert a theme to `--pptx-*` CSS vars.                                                        |
| `ViewerThemeProvider`, `useViewerTheme` | provider/hook | Advanced theme context.                                                                        |

## Next steps

- [Getting Started](/react/getting-started) — a minimal working example.
- [Component Props](/react/props) — the complete `PowerPointViewerProps` reference.
- [Imperative Handle](/react/handle) — the ref API.
- [Theming](/react/theming) — colours, radius, CSS vars, providers.
- [Hooks](/react/hooks) — architecture and the public hook surface.
- [Export](/react/export) — PNG/PDF/SVG/GIF/video and the html2canvas pipeline.
- [Collaboration](/react/collaboration) — Yjs co-editing and presence.

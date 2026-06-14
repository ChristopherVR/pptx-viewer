---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: 'pptx-viewer'
  text: 'A PowerPoint SDK for TypeScript'
  tagline: Parse, create, edit, render, and convert .pptx files — in the browser and Node.js. Framework-agnostic core plus a full-featured React viewer/editor.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/introduction
    - theme: alt
      text: User Guide
      link: /user/
    - theme: alt
      text: View on GitHub
      link: https://github.com/ChristopherVR/pptx-viewer

features:
  - icon: 📂
    title: Parse & Round-trip
    details: Load .pptx files into a fully-typed PptxData model and serialize edits back to a valid file. Handles 16 element types, themes, masters, layouts, and OOXML Strict conformance.
    link: /core/loading
    linkText: Loading & Parsing
  - icon: 🏗️
    title: Build from Scratch
    details: A fluent builder API for creating presentations programmatically — text, shapes, images, tables, charts, and more, without touching raw OpenXML.
    link: /core/builder
    linkText: The Builder API
  - icon: ⚛️
    title: React Viewer & Editor
    details: A CSS-rendered PowerPointViewer component with a WYSIWYG editor, inspector, presenter mode, find/replace, and export — driven by 67+ composable hooks.
    link: /react/
    linkText: React Viewer
  - icon: 📝
    title: Convert to Markdown
    details: Turn presentations into clean Markdown (or positioned HTML) with optional media extraction, speaker notes, and metadata.
    link: /core/converter
    linkText: Markdown Converter
  - icon: 🎨
    title: Faithful Rendering
    details: 187+ preset shapes, 23 chart types, SmartArt, animations, morph transitions, EMF/WMF metafiles, embedded fonts, and 3D models — rendered with HTML, CSS, and SVG.
    link: /guide/concepts
    linkText: Core Concepts
  - icon: 🤝
    title: Collaborate & Automate
    details: Real-time co-editing via Yjs CRDT, AES-128/256 encryption, an MCP server with 24 tools, and a CLI for headless workflows.
    link: /packages/mcp
    linkText: MCP & Tools
---

<div style="max-width: 1152px; margin: 3rem auto 0; padding: 0 24px;">

![The pptx-react-viewer editor: ribbon toolbar, slide thumbnails, and a slide rendered on the canvas](https://raw.githubusercontent.com/ChristopherVR/pptx-viewer/main/.github/assets/editor.png)

<p style="text-align: center; color: var(--vp-c-text-2); margin-top: 0.75rem;">
The <a href="/pptx-viewer/react/">React viewer/editor</a> in action — rendered entirely with HTML, CSS, and SVG. Vue and Angular bindings share the same engine.
</p>

</div>

## Install in one line

Pick the package for your stack — the UI packages **bundle the core engine**, so you install just one:

| Stack                         | Install                     |
| ----------------------------- | --------------------------- |
| **React**                     | `npm i pptx-react-viewer`   |
| **Vue 3**                     | `npm i pptx-vue-viewer`     |
| **Angular**                   | `npm i pptx-angular-viewer` |
| **Headless** (Node / browser) | `npm i pptx-viewer-core`    |
| **CLI / MCP / AI tools**      | `npm i pptx-viewer-mcp`     |

→ Full details in the [installation guide](/guide/installation).

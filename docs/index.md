---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: 'pptx-viewer'
  text: 'PowerPoint SDK for TypeScript'
  tagline: Parse, create, edit, render, and convert .pptx files - browser and Node.js. Works with React, Vue 3, and Angular. No native dependencies.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/introduction
    - theme: brand
      text: Try the Demo
      link: https://christophervr.github.io/pptx-viewer/demo/
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
    details: A fluent builder API for creating presentations programmatically - text, shapes, images, tables, charts, and more, without touching raw OpenXML.
    link: /core/builder
    linkText: The Builder API
  - icon: ⚛️
    title: React, Vue & Angular
    details: Drop-in viewer components for all three major frameworks. The same rendering engine powers all bindings - HTML/CSS slides, full visual fidelity, no Canvas.
    link: /guide/installation
    linkText: Choose a Framework
  - icon: 📝
    title: Convert to Markdown
    details: Turn presentations into clean Markdown (or positioned HTML) with optional media extraction, speaker notes, and metadata.
    link: /core/converter
    linkText: Markdown Converter
  - icon: 🎨
    title: Faithful Rendering
    details: 187+ preset shapes, 23 chart types, SmartArt, animations, morph transitions, EMF/WMF metafiles, embedded fonts, and 3D models - rendered with HTML, CSS, and SVG.
    link: /guide/concepts
    linkText: Core Concepts
  - icon: 🤖
    title: MCP & AI Tooling
    details: 25 pure tool functions, Zod schemas, and an MCP server so AI agents (Claude, Cursor, Copilot) can read, write, and transform PPTX files directly.
    link: /packages/mcp
    linkText: MCP & Tools
  - icon: 🤝
    title: Collaborate & Encrypt
    details: Real-time co-editing via Yjs CRDT with presence tracking. AES-128/256 encryption for password-protected files. Collaboration codec for Y.Doc round-trips.
    link: /react/collaboration
    linkText: Collaboration
  - icon: 🚀
    title: Export Everything
    details: PNG, JPEG, SVG, PDF, GIF, and video export from the browser. SVG export also works headlessly in Node.js via SvgExporter with no DOM.
    link: /react/export
    linkText: Export Options
---

<div style="max-width: 1152px; margin: 3rem auto 0; padding: 0 24px;">

## See it in action

![The pptx-react-viewer editor: ribbon toolbar, slide thumbnails, and a slide rendered on the canvas](https://raw.githubusercontent.com/ChristopherVR/pptx-viewer/main/.github/assets/editor.png)

<p style="text-align: center; color: var(--vp-c-text-2); margin-top: 0.75rem;">
The viewer/editor rendered entirely with HTML, CSS, and SVG - sharp text at any zoom, native accessibility, no Canvas. Vue and Angular bindings use the same engine. <a href="https://christophervr.github.io/pptx-viewer/demo/">Try the live demo.</a>
</p>

## Choose your stack

The UI packages **bundle the core engine**, so you install exactly one package:

| I'm building...               | Install                     | What you get                                                                 |
| ----------------------------- | --------------------------- | ---------------------------------------------------------------------------- |
| **React app**                 | `npm i pptx-react-viewer`   | Full-featured viewer + WYSIWYG editor, presenter mode, export, collaboration |
| **Vue 3 app**                 | `npm i pptx-vue-viewer`     | The same viewer + editor feature set, built on the same engine               |
| **Angular app**               | `npm i pptx-angular-viewer` | The same viewer + editor feature set, built on the same engine               |
| **Headless (Node / browser)** | `npm i pptx-viewer-core`    | Parse, create, edit, convert, encrypt - no UI, no framework dependency       |
| **AI / MCP tooling**          | `npm i pptx-viewer-mcp`     | 25 MCP tools, CLI, Y.Doc collaboration codec                                 |

Not sure which one? `npx @christophervr/pptx-viewer` walks you through it interactively. Full installation details and peer dependency requirements are in the [installation guide](/guide/installation), and per-package release notes live under [Releases](/releases/).

## Programmatic use

All three UI packages bundle `pptx-viewer-core`, but you can also use the core engine on its own for headless workflows - no browser, no framework:

```ts
import { PptxHandler, PptxMarkdownConverter } from 'pptx-viewer-core';

const handler = new PptxHandler();
const data = await handler.load(await fs.readFile('deck.pptx'));

// Walk the slide data model
for (const slide of data.slides) {
	for (const el of slide.elements) {
		if (el.type === 'text') console.log(el.text);
	}
}

// Mutate and save back to .pptx
data.slides[0].elements[0].text = 'Updated';
await fs.writeFile('out.pptx', await handler.save(data.slides));

// Or convert to Markdown
const md = await new PptxMarkdownConverter('./out', { semanticMode: true }).convert(data);
```

The core engine runs identically in Node.js, Bun, Deno, browser tabs, Web Workers, and serverless functions.

## MCP and AI agents

`pptx-viewer-mcp` exposes 25 PPTX manipulation tools as an MCP server. Any MCP-compatible client (Claude Desktop, Cursor, VS Code Copilot) can use them to read, edit, and convert presentations without writing code:

```json
{
	"mcpServers": {
		"pptx": { "command": "npx", "args": ["pptx-viewer-mcp"] }
	}
}
```

Alternatively, call the tool functions directly in your own pipeline - they are pure functions that take `PptxData` and return `PptxData`:

```ts
import { replaceText, addSlide, convertToMarkdown } from 'pptx-viewer-mcp';
```

See the [MCP & Tools reference](/packages/mcp) for the full tool catalogue, Zod schemas, and the Y.Doc collaboration codec.

## Limitations

Before adopting the library, read the [full limitations page](/guide/limitations). Key caveats:

- **OLE objects are read-only** - embedded Excel/Word content can be displayed and downloaded but not edited in place
- **CSS rendering approximates some effects** - backdrop-filter and path gradients are approximated on screen; more effects flatten in raster export
- **Vue / Angular are at parity with React** - editing, presenter mode, export, dialogs, and table/SmartArt/chart editing are available in all three bindings; remaining differences are cosmetic
- **EMF/WMF on Canvas only** - the EMF converter requires `HTMLCanvasElement` or `OffscreenCanvas`; pure Node.js needs a canvas polyfill

## Extending the viewer

The React viewer is built on 67+ composable hooks. You can hook into any layer:

- **Custom element renderers** - override the default renderer for any `PptxElement` type by mapping the `type` discriminant to your own component
- **Theming** - override CSS custom properties or pass a `theme` prop to restyle the toolbar, inspector, and slides ([Theming guide](/react/theming))
- **Imperative handle** - use `ref` to call `exportAsPng`, `goToSlide`, `setZoom`, and other methods programmatically ([Imperative handle reference](/react/handle))
- **Custom hooks** - import and compose the individual hooks (`useEditorOperations`, `useExportHandlers`, etc.) to build your own viewer shell ([Hooks reference](/react/hooks))
- **New element types** - the core engine's mixin architecture makes adding a new `PptxElement` type a seven-step process ([Adding an element type](/contributing/adding-element-type))

</div>

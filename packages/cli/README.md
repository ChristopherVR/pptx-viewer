# @christophervr/pptx-viewer

[![npm version](https://img.shields.io/npm/v/%40christophervr%2Fpptx-viewer.svg)](https://www.npmjs.com/package/@christophervr/pptx-viewer)
[![license](https://img.shields.io/npm/l/%40christophervr%2Fpptx-viewer.svg)](https://github.com/ChristopherVR/pptx-viewer/blob/main/LICENSE)

> The interactive installer for the [pptx-viewer](https://github.com/ChristopherVR/pptx-viewer) family: pick what you're building, and it installs the right package(s) plus their required companions, or bootstraps a brand-new starter app for you.

![The pptx-viewer editor: ribbon toolbar, slide thumbnails, and a slide rendered on the canvas](https://raw.githubusercontent.com/ChristopherVR/pptx-viewer/main/.github/assets/editor.png)

This is what you get one `npx` away: a working `.pptx` viewer/editor, wired up in a React, Vue, or Angular app, or just the framework-agnostic engine on its own.

<samp>**[▶️ Try the live demo](https://christophervr.github.io/pptx-viewer/demo/)** · **[📦 npm](https://www.npmjs.com/package/@christophervr/pptx-viewer)** · **[📖 Full docs](https://christophervr.github.io/pptx-viewer/)** · **[🧩 Core SDK](https://www.npmjs.com/package/pptx-viewer-core)**</samp>

---

## Usage

```bash
npx @christophervr/pptx-viewer@latest
```

It first asks what you're building (multiple choice, comma-separated):

```
What are you building with pptx-viewer? (you can pick more than one)

  1) React - pptx-react-viewer, a viewer/editor component for a React 19 app
  2) Vue - pptx-vue-viewer, a viewer/editor component for a Vue 3.5+ app
  3) Angular - pptx-angular-viewer, a viewer/editor component for an Angular 22+ app
  4) Core engine only - pptx-viewer-core, the framework-agnostic SDK, no UI
  5) MCP server - pptx-viewer-mcp, PowerPoint editing tools for AI agents
```

Picking more than one is fine, for example React plus the MCP server to get both a viewer and AI-agent tooling in the same repo. `pptx-viewer-mcp` never gets installed as a dependency: since it's meant to be launched by an MCP client via `npx`, this just prints the client config to paste in.

### Compatibility check

If you picked React, Vue, or Angular and a `package.json` already exists in the current directory, the CLI looks at what's actually installed (or declared) for `react`, `vue`, or `@angular/core` and compares it against the major version each viewer package requires. If they don't match (say, `react@18` in a project but `pptx-react-viewer` needs `react@^19`), it warns you and asks whether to continue before touching anything.

### Install here, or scaffold a new project?

When exactly one UI framework is selected, you're asked how to set it up:

- **Install here** adds the package(s) to the project in the current directory (a `package.json` must already exist; run `npm init -y` first if not).
- **Scaffold a new project** bootstraps a brand-new starter app in its own folder, using the framework's own official scaffolding tool ([`create-vite`](https://www.npmjs.com/package/create-vite) for React/Vue, [`@angular/cli`](https://www.npmjs.com/package/@angular/cli) for Angular), then wires in a minimal working `PowerPointViewer` example and installs the viewer package on top.

Scaffolding is only offered for a single framework at a time; if you select more than one UI framework together, the CLI installs into the current project instead.

Either way, it detects your package manager (`bun`, `pnpm`, `yarn`, or `npm`, from whichever lockfile is in the current directory) and prints a short quick-start snippet once it's done.

### Non-interactive use

```bash
npx @christophervr/pptx-viewer --target react,mcp --yes            # skip both prompts
npx @christophervr/pptx-viewer --target mcp                        # just print the MCP client config
npx @christophervr/pptx-viewer --target react --scaffold --dir my-app --yes
npx @christophervr/pptx-viewer --pm pnpm                           # force a package manager instead of auto-detecting
```

| Flag             | Meaning                                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------------------- |
| `--target <ids>` | Comma-separated: `react`, `vue`, `angular`, `core`, `mcp`. Skips the picker.                               |
| `--scaffold`     | Bootstrap a new project instead of installing here. Needs exactly one of `react`/`vue`/`angular` selected. |
| `--dir <name>`   | Project directory name for `--scaffold` (default: `pptx-<target>-app`).                                    |
| `--pm <manager>` | `bun`, `pnpm`, `yarn`, or `npm`. Skips auto-detection.                                                     |
| `--yes`, `-y`    | Skip confirmation prompts (including the compatibility warning).                                           |
| `--help`, `-h`   | Print usage.                                                                                               |

## What it installs

| Target         | Package                                                                    | What you get                                                            |
| -------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **React**      | [`pptx-react-viewer`](https://www.npmjs.com/package/pptx-react-viewer)     | View, edit, present, collaborate, and export `.pptx` files in React 19. |
| **Vue**        | [`pptx-vue-viewer`](https://www.npmjs.com/package/pptx-vue-viewer)         | The Vue 3.5+ counterpart, feature-equivalent to the React package.      |
| **Angular**    | [`pptx-angular-viewer`](https://www.npmjs.com/package/pptx-angular-viewer) | The Angular 22+ counterpart, feature-equivalent to the React package.   |
| **Core only**  | [`pptx-viewer-core`](https://www.npmjs.com/package/pptx-viewer-core)       | The framework-agnostic parse/edit/save/convert SDK, no UI.              |
| **MCP server** | [`pptx-viewer-mcp`](https://www.npmjs.com/package/pptx-viewer-mcp)         | 25 PowerPoint editing tools exposed to AI agents (Claude, Cursor, ...). |

## Why this exists

Each pptx-viewer package documents its own install command, but the exact list of companion packages differs per binding (peer dependencies like `react`/`vue`, shared ones like `jszip`/`fast-xml-parser`, optional ones like `three`). This CLI is that install line, made interactive, so you don't have to go look it up, plus a scaffold mode for starting from nothing.

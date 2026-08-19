# @christophervr/pptx-viewer

[![npm version](https://img.shields.io/npm/v/%40christophervr%2Fpptx-viewer.svg)](https://www.npmjs.com/package/@christophervr/pptx-viewer)
[![license](https://img.shields.io/npm/l/%40christophervr%2Fpptx-viewer.svg)](https://github.com/ChristopherVR/pptx-viewer/blob/main/LICENSE)

> The interactive installer for the [pptx-viewer](https://github.com/ChristopherVR/pptx-viewer) family: pick what you're building, and it installs the right package(s) plus their required companions, or bootstraps a brand-new starter app for you. Installed as a dependency and imported (not run via `npx`), it doubles as a drop-in for [`pptx-react-viewer`](https://www.npmjs.com/package/pptx-react-viewer) - see [It's also a drop-in for `pptx-react-viewer`](#its-also-a-drop-in-for-pptx-react-viewer).

![The interactive installer selecting React and MCP, then scaffolding a starter app](https://raw.githubusercontent.com/ChristopherVR/pptx-viewer/main/.github/assets/packages/cli-installer.gif)

This is what you get one `npx` away: a working `.pptx` viewer/editor, wired up in a React, Vue, Angular, Svelte, or vanilla JavaScript app, or just the framework-agnostic engine on its own.

<samp>**[▶️ Try the live demo](https://christophervr.github.io/pptx-viewer/demo/)** · **[📦 npm](https://www.npmjs.com/package/@christophervr/pptx-viewer)** · **[📖 Full docs](https://christophervr.github.io/pptx-viewer/)** · **[🧩 Core SDK](https://www.npmjs.com/package/pptx-viewer-core)**</samp>

---

## Usage

```bash
npx @christophervr/pptx-viewer@latest
```

It first asks what you're building with an arrow-key checklist (`↑`/`↓` to move, `space` to toggle, `a` to select all, `enter` to confirm):

```
What are you building with pptx-viewer? (you can pick more than one)
(↑/↓ move, space toggle, a select all, enter confirm)

❯ ◉ React - pptx-react-viewer, a viewer/editor component for a React 18/19 app
  ◯ Vue - pptx-vue-viewer, a viewer/editor component for a Vue 3.5+ app
  ◯ Angular - pptx-angular-viewer, a viewer/editor component for an Angular 19-22 app
  ◯ Svelte - pptx-svelte-viewer, a viewer/editor component for a Svelte 5 app
  ◯ Vanilla JS - pptx-vanilla-viewer, a zero-framework viewer/editor, plain DOM
  ◯ Core engine only - pptx-viewer-core, the framework-agnostic SDK, no UI
  ◯ MCP server - pptx-viewer-mcp, PowerPoint editing tools for AI agents
```

The whole flow is colour-highlighted (current row, confirmations, warnings, errors) and falls back to a plain numbered prompt in shells without raw keyboard input (piped stdin, some CI runners) or when `NO_COLOR`/a non-TTY output disables colour.

Picking more than one is fine, for example React plus the MCP server to get both a viewer and AI-agent tooling in the same repo. `pptx-viewer-mcp` never gets installed as a dependency: since it's meant to be launched by an MCP client via `npx`, this just prints the client config to paste in.

### Compatibility check

If you picked React, Vue, Angular, or Svelte and a `package.json` already exists in the current directory, the CLI looks at what's actually installed (or declared) for `react`, `vue`, `@angular/core`, or `svelte` and compares it against the major version each viewer package requires. If they don't match (say, `react@18` in a project but `pptx-react-viewer` needs `react@^19`), it warns you and asks whether to continue before touching anything. (Vanilla JS has no framework peer, so there is nothing to check.)

### Install here, or scaffold a new project?

When exactly one UI framework is selected, you're asked how to set it up:

- **Install here** adds the package(s) to the project in the current directory (a `package.json` must already exist; run `npm init -y` first if not).
- **Scaffold a new project** bootstraps a brand-new starter app in its own folder, using the framework's own official scaffolding tool ([`create-vite`](https://www.npmjs.com/package/create-vite) for React/Vue/Svelte/Vanilla JS, [`@angular/cli`](https://www.npmjs.com/package/@angular/cli) for Angular), then wires in a working `PowerPointViewer` example (same pattern as the [live demos](https://christophervr.github.io/pptx-viewer/demo/): open an existing `.pptx`, or click "New Presentation" to build a blank deck with `PptxHandler.createBlank` and start editing right away) and installs the viewer package plus `pptx-viewer-core` on top.

Scaffolding is only offered for a single framework at a time; if you select more than one UI framework together, the CLI installs into the current project instead.

Either way, it detects your package manager (`bun`, `pnpm`, `yarn`, or `npm`, from whichever lockfile is in the current directory) and prints a short quick-start snippet once it's done.

### Non-interactive use

```bash
npx @christophervr/pptx-viewer --target react,mcp --yes            # skip both prompts
npx @christophervr/pptx-viewer --target mcp                        # just print the MCP client config
npx @christophervr/pptx-viewer --target react --scaffold --dir my-app --yes
npx @christophervr/pptx-viewer --pm pnpm                           # force a package manager instead of auto-detecting
```

| Flag             | Meaning                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| `--target <ids>` | Comma-separated: `react`, `vue`, `angular`, `svelte`, `vanilla`, `core`, `mcp`. Skips the picker. |
| `--scaffold`     | Bootstrap a new project instead of installing here. Needs exactly one UI binding target selected. |
| `--dir <name>`   | Project directory name for `--scaffold` (default: `pptx-<target>-app`).                           |
| `--pm <manager>` | `bun`, `pnpm`, `yarn`, or `npm`. Skips auto-detection.                                            |
| `--yes`, `-y`    | Skip confirmation prompts (including the compatibility warning).                                  |
| `--help`, `-h`   | Print usage.                                                                                      |

## It's also a drop-in for `pptx-react-viewer`

`@christophervr/pptx-viewer` is the name most people search or guess first, so as well as being the `npx` installer above, **the package itself, imported as a library, re-exports [`pptx-react-viewer`](https://www.npmjs.com/package/pptx-react-viewer) directly.** React is this project's primary/flagship binding, so `npm install @christophervr/pptx-viewer` and importing from it behaves exactly like installing `pptx-react-viewer` on its own:

```bash
npm install @christophervr/pptx-viewer
```

```tsx
import { PowerPointViewer } from '@christophervr/pptx-viewer';
import 'pptx-react-viewer/styles.css'; // styles ship under the real package name

<PowerPointViewer content={arrayBuffer} canEdit />;
```

Everything [`pptx-react-viewer`](https://www.npmjs.com/package/pptx-react-viewer) exports (`PowerPointViewer`, `Toolbar`, `SlideCanvas`, theme helpers, and the rest) is re-exported from the package root here too, so the two names are interchangeable as a dependency. What differs is what you get from each command:

| You run/import                                 | What you get                                                                                       |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `npx @christophervr/pptx-viewer`               | The interactive installer/scaffolder (this page's main usage) - no code runs, nothing is imported. |
| `import ... from '@christophervr/pptx-viewer'` | The React viewer component, re-exported from `pptx-react-viewer`.                                  |
| `import ... from 'pptx-react-viewer'` directly | The exact same component, one dependency lighter (no installer code pulled in).                    |

Reach for the `pptx-react-viewer` name directly in new React projects; this package's re-export exists so nothing breaks if you (or your editor's autocomplete) reach for `@christophervr/pptx-viewer` instead. If you're building for Vue, Angular, Svelte, or vanilla JS, use the matching package from the table below directly - the re-export here is React-only.

## What it installs

| Target         | Package                                                                    | What you get                                                               |
| -------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **React**      | [`pptx-react-viewer`](https://www.npmjs.com/package/pptx-react-viewer)     | View, edit, present, collaborate, and export `.pptx` files in React 18/19. |
| **Vue**        | [`pptx-vue-viewer`](https://www.npmjs.com/package/pptx-vue-viewer)         | The Vue 3.5+ counterpart, feature-equivalent to the React package.         |
| **Angular**    | [`pptx-angular-viewer`](https://www.npmjs.com/package/pptx-angular-viewer) | The Angular 19-22 counterpart, feature-equivalent to the React package.    |
| **Svelte**     | [`pptx-svelte-viewer`](https://www.npmjs.com/package/pptx-svelte-viewer)   | The Svelte 5 counterpart, built on the same shared engine.                 |
| **Vanilla JS** | [`pptx-vanilla-viewer`](https://www.npmjs.com/package/pptx-vanilla-viewer) | The zero-framework binding: plain DOM, one factory function.               |
| **Core only**  | [`pptx-viewer-core`](https://www.npmjs.com/package/pptx-viewer-core)       | The framework-agnostic parse/edit/save/convert SDK, no UI.                 |
| **MCP server** | [`pptx-viewer-mcp`](https://www.npmjs.com/package/pptx-viewer-mcp)         | 54 PowerPoint editing tools exposed to AI agents (Claude, Cursor, ...).    |

## Why this exists

Each pptx-viewer package documents its own install command, but the exact list of companion packages differs per binding (peer dependencies like `react`/`vue`, shared ones like `jszip`/`fast-xml-parser`, optional ones like `three`). This CLI is that install line, made interactive, so you don't have to go look it up, plus a scaffold mode for starting from nothing.

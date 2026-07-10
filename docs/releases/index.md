---
title: Releases
---

# Releases

Every package in the monorepo is versioned and released independently: a
package only gets a new version when its own code (or a dependency bundled
into it) changes, and the bump level follows
[Conventional Commits](https://www.conventionalcommits.org) (breaking change =
major, feature = minor, everything else = patch).

Per-package release notes, generated from commit history by the release
pipeline:

| Package                                | Release notes                  | npm                                                                                                                             |
| -------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `pptx-viewer-core` (headless engine)   | [Changelog](/releases/core)    | [![npm](https://img.shields.io/npm/v/pptx-viewer-core)](https://www.npmjs.com/package/pptx-viewer-core)                         |
| `pptx-react-viewer` (React)            | [Changelog](/releases/react)   | [![npm](https://img.shields.io/npm/v/pptx-react-viewer)](https://www.npmjs.com/package/pptx-react-viewer)                       |
| `pptx-vue-viewer` (Vue 3)              | [Changelog](/releases/vue)     | [![npm](https://img.shields.io/npm/v/pptx-vue-viewer)](https://www.npmjs.com/package/pptx-vue-viewer)                           |
| `pptx-angular-viewer` (Angular)        | [Changelog](/releases/angular) | [![npm](https://img.shields.io/npm/v/pptx-angular-viewer)](https://www.npmjs.com/package/pptx-angular-viewer)                   |
| `pptx-vanilla-viewer` (Vanilla JS)     | [Changelog](/releases/vanilla) | [![npm](https://img.shields.io/npm/v/pptx-vanilla-viewer)](https://www.npmjs.com/package/pptx-vanilla-viewer)                   |
| `pptx-svelte-viewer` (Svelte 5)        | [Changelog](/releases/svelte)  | [![npm](https://img.shields.io/npm/v/pptx-svelte-viewer)](https://www.npmjs.com/package/pptx-svelte-viewer)                     |
| `pptx-viewer-mcp` (MCP server & tools) | [Changelog](/releases/mcp)     | [![npm](https://img.shields.io/npm/v/pptx-viewer-mcp)](https://www.npmjs.com/package/pptx-viewer-mcp)                           |
| `@christophervr/pptx-viewer` (CLI)     | [Changelog](/releases/cli)     | [![npm](https://img.shields.io/npm/v/%40christophervr%2Fpptx-viewer)](https://www.npmjs.com/package/@christophervr/pptx-viewer) |

A consolidated cross-package view lives in the repository's
[root CHANGELOG.md](https://github.com/ChristopherVR/pptx-viewer/blob/main/CHANGELOG.md),
and every release is also published on the
[GitHub Releases page](https://github.com/ChristopherVR/pptx-viewer/releases).

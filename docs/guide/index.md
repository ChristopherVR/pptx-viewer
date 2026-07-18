---
title: Documentation Overview
description: A map of the pptx-viewer documentation - which section to read depending on whether you are embedding a viewer, working with .pptx files programmatically, using the editor, or automating with agents.
---

# Documentation overview

The documentation is organised by what you are trying to do. Use this page to find the right section, then follow the reading order it suggests.

## Choose a path

| You want to...                                         | Start with                                                                                                                                                                                                              | Then                                                                                                           |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Embed a PowerPoint viewer or editor in a web app       | Your framework's getting-started page: [React](/react/getting-started), [Vue 3](/vue/getting-started), [Angular](/angular/getting-started), [Svelte 5](/svelte/getting-started), [Vanilla JS](/vanilla/getting-started) | The same section's props/API reference, then [Theming](/guide/theming) and [Localization](/guide/localization) |
| Read, edit, or generate `.pptx` files from code        | [Core: Loading & Parsing](/core/loading) and [the Builder API](/core/builder)                                                                                                                                           | [Editing](/core/editing), [Saving](/core/saving), [the data model](/guide/data-model)                          |
| Convert presentations to Markdown, images, PDF, or SVG | [Markdown Converter](/core/converter) and [SVG Export](/core/svg-export)                                                                                                                                                | Your binding's Export page for in-browser formats                                                              |
| Use the editor UI (you are not writing code)           | [User Guide](/user/)                                                                                                                                                                                                    | [Editing Slides](/user/editing), [Keyboard Shortcuts](/user/shortcuts)                                         |
| Let AI agents or scripts work with presentations       | [MCP & Tools](/packages/mcp)                                                                                                                                                                                            | [Core CLI](/core/cli)                                                                                          |
| Understand how the library works internally            | [Architecture](/guide/architecture)                                                                                                                                                                                     | [OOXML conformance](/architecture/openxml-conformance), [Limitations](/guide/limitations)                      |

## New to the project

If none of the paths above fits yet, read these three pages in order:

1. [What is pptx-viewer?](/guide/introduction): the package family and what each part does.
2. [Installation](/guide/installation): which package to install for your stack.
3. [Quick Start](/guide/quick-start): four end-to-end flows using the public API.

## Sections at a glance

| Section                                                                                                                | Audience                 | Contents                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------- |
| **Developer Guide** (this section)                                                                                     | Developers               | Concepts that apply to every package: architecture, data model, theming, i18n, limitations. |
| **[Core](/core/)**                                                                                                     | Developers               | The headless engine: load, edit, build, save, convert, encrypt. No UI.                      |
| **[React](/react/)** / **[Vue](/vue/)** / **[Angular](/angular/)** / **[Svelte](/svelte/)** / **[Vanilla](/vanilla/)** | Developers               | One section per UI binding: getting started, props/API, theming, export, collaboration.     |
| **[User Guide](/user/)**                                                                                               | End users of the editor  | How to view, edit, present, export, and collaborate in the editor UI. No code.              |
| **[MCP & Tools](/packages/mcp)**                                                                                       | Agent/automation authors | The MCP server, its 50+ tools, and the CLI.                                                 |
| **[Releases](/releases/)**                                                                                             | Everyone                 | Per-package release notes.                                                                  |

---
title: User Guide Overview
description: How to view, edit, present, export, and collaborate on PowerPoint presentations using the pptx-viewer app.
---

# User Guide

This guide is for people **using** the pptx-viewer app to work with PowerPoint (`.pptx`) presentations in the browser. It covers viewing, editing, presenting, exporting, and collaborating — no coding required.

If you are a developer integrating the viewer into your own application, see the [React Viewer developer docs](/react/) instead.

::: info Features depend on how the app was set up
pptx-viewer is a configurable component, so the exact buttons and panels you see depend on how the developer who built your app turned features on. For example, editing is only available when the component is configured with editing enabled (`canEdit`), and real-time collaboration only appears when a collaboration session is configured. Where a feature is optional, this guide says so.
:::

## What you can do

| Task              | What it means                                                                                  | Page                                  |
| ----------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------- |
| **View**          | Open a `.pptx` file and read through its slides, notes, charts, tables, and media.             | [Viewing](/user/viewing)              |
| **Edit**          | Add, move, resize, and restyle elements; manage slides; find & replace; comment.               | [Editing](/user/editing)              |
| **Present**       | Run a fullscreen slideshow with animations, transitions, presenter view, and annotation tools. | [Presenting](/user/presenting)        |
| **Export**        | Save to PNG, JPEG, SVG, PDF, GIF, video, or back to `.pptx`.                                   | [Exporting](/user/exporting)          |
| **Collaborate**   | Co-edit a presentation in real time with live cursors and presence.                            | [Collaboration](/user/collaboration)  |
| **Use shortcuts** | Speed up navigation, editing, and presenting with the keyboard.                                | [Keyboard Shortcuts](/user/shortcuts) |

## The main parts of the screen

When you open a presentation in edit or preview mode, the screen is divided into a few regions:

- **Toolbar** (top) — A tabbed ribbon with sections such as **File, Home, Insert, Text, Draw, Arrange, Design, Transitions, Animations, Slide Show, Review, View,** and **Help**. The available tabs and buttons depend on the current mode and whether editing is enabled.
- **Slides panel** (left) — A scrollable strip of slide thumbnails. Click a thumbnail to jump to that slide; drag to reorder. Slides can be organised into sections.
- **Slide canvas** (centre) — The large editing/viewing area where the active slide is rendered. You can zoom and pan here, and (in edit mode) select and manipulate elements directly.
- **Inspector panel** (right) — A context-sensitive properties panel. What it shows depends on what is selected: slide background and layout when nothing is selected, or position, size, fill, stroke, text, image, table, chart, animation, and transition properties for the selected element.
- **Notes panel** (below the canvas) — An editor for the current slide's speaker notes.
- **Status bar / bottom bar** (bottom) — Shows zoom controls, the current slide number, save/dirty status, and quick toggles.

For a fullscreen slideshow, all of this is replaced by the **presentation layer** — just the slide, plus a floating slideshow toolbar and optional presenter view. See [Presenting](/user/presenting).

## Desktop vs. mobile

The viewer renders slides as crisp HTML/CSS (not a flat image), so text stays sharp at any zoom and works with screen readers and text selection.

::: warning Designed for desktop
The toolbar, inspector panels, and dialogs are designed for desktop-sized screens. On a phone or small tablet, the app adapts key controls into **bottom sheets** and supports touch gestures (drag, pinch-to-zoom), but the full editing experience is best on a larger screen. For serious editing, use a desktop or laptop.
:::

## Where to next

- New to the app? Start with [Viewing Presentations](/user/viewing).
- Ready to make changes? See [Editing Slides](/user/editing).
- Giving a talk? Read [Presenting](/user/presenting).

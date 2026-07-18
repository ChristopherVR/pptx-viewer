---
title: User Guide Overview
description: An orientation to the pptx-viewer editor - the parts of the screen, how to open a file, and where to find each feature.
---

# User Guide

This guide is for people **using** the pptx-viewer app to work with PowerPoint (`.pptx`) presentations in the browser. It covers viewing, editing, presenting, exporting, and collaborating. No coding is required.

If you are a developer integrating the viewer into your own application, see the [React Viewer developer docs](/react/) instead.

::: info Features depend on how the app was set up
pptx-viewer is a configurable component, so the exact buttons and panels you see depend on how the developer who built your app turned features on. Editing is only available when the app enables it (a **Read-only** badge appears in the toolbar when it does not), and collaboration controls only appear when sharing is enabled. Where a feature is optional, this guide says so.
:::

## What the editor is

pptx-viewer opens PowerPoint files directly in your browser and renders each slide as real HTML and SVG, not a flat image. Text stays sharp at any zoom, can be selected and copied, and works with screen readers. In edit mode you can change slides and save the result back to a standard `.pptx` file.

![The editor with a presentation open](/docs-shots/editor.jpg)

## Opening a file

1. Drag a `.pptx` file onto the drop area labelled **"Drop a .pptx file here or click to browse"**, or click the area to open your system's file picker.
2. Wait a moment while the file is parsed. The first slide appears on the canvas with thumbnails on the left.

You can also click **"or create a New Presentation"** to start from a blank one-slide deck.

::: tip Your file stays on your machine
The file is processed entirely in the browser. Nothing is uploaded to a server: opening, editing, and saving all happen locally.
:::

::: warning Supported files
The app opens `.pptx` files only. Password-encrypted files cannot be opened; a dialog titled **Encrypted File** appears instead.
:::

If the app finds unsaved work from a previous visit, a banner titled **Unsaved changes recovered** appears with **Restore** and **Dismiss** buttons. See [Autosave and recovery](/user/editing#autosave-and-recovery).

## A tour of the screen

![Full editor layout](/user-guide/overview-full-layout.jpg)

From top to bottom:

### Title bar

The top strip shows the file name and its save state (for example "Saved to this PC" or "Unsaved changes"). When editing is enabled it also holds:

- The **AutoSave** switch (On/Off).
- Quick **Save**, **Undo**, and **Redo** buttons.
- A search box, **"Tell me what you want to do"**. Type a command name (for example "table") to get a clickable list of matching actions, or press **Enter** to search for the text inside your slides.

### Ribbon (toolbar)

A tabbed ribbon under the title bar. The tabs, in order:

**File, Home, Insert, Draw, Design, Transitions, Animations, Slide Show, Record, Review, View, Help**

![Toolbar close-up](/user-guide/overview-toolbar.jpg)

- **File** opens a full-screen backstage with Open, Save, Save As, Print, Share, and Export pages. See [Exporting](/user/exporting).
- **Home** holds the everyday tools: clipboard, new slides and layouts, fonts, paragraph formatting, find and replace, drawing, and arrange controls. See [Editing](/user/editing).
- **Insert** adds new elements: text boxes, shapes, images, media, tables, charts, SmartArt, equations, and more.
- **Slide Show** starts a presentation. See [Presenting](/user/presenting).

The ribbon appears only in edit mode. On the right end of the tab row sit the **Record** and **Share** buttons; the row above holds toggles for the slides panel, comments, and inspector, the **Present** button, a Settings gear, and a **"..."** overflow menu that repeats the export and utility actions.

### Slides panel (left)

A scrollable strip of slide thumbnails.

![Slides panel](/user-guide/overview-slides-panel.jpg)

- Click a thumbnail to jump to that slide.
- Drag thumbnails to reorder (edit mode).
- Hidden slides appear dimmed with a diagonal hatch and an eye-off icon.
- The **Add Slide** button at the bottom inserts a new slide.
- Slides can be grouped into named **sections** with their own headers.

### Slide canvas (centre)

The large area where the active slide renders. Here you zoom and pan, and in edit mode select, move, and edit elements directly. Rulers, a grid, and draggable guides can be switched on from the **View** tab.

### Inspector (right)

A context-sensitive side panel with three tabs:

- **Elements** - a layer list of every element on the slide, in stacking order. Click a row to select that element on the canvas.
- **Properties** - settings for the current selection. With nothing selected it shows presentation, theme, slide size, slide transition, and background settings; with an element selected it shows position and size plus panels specific to the element type (text, fill and stroke, table, chart data, image, media, and so on), and an **Animation** panel.
- **Comments** - the comment threads attached to the current slide, with reply and resolve controls.

Toggle the inspector with the panel button in the toolbar's top row.

### Notes panel (below the canvas)

An editor for the current slide's speaker notes. Toggle it with the **Notes** button in the status bar.

### Status bar (bottom)

From left to right:

- **Slide x of y** counter.
- The save status: **Unsaved changes**, **All saved**, **Saving...**, or **Saved [time]**.
- The **Notes** toggle.
- Three view buttons: **Normal view**, **Slide sorter**, **Slide show**.
- The connection indicator when a collaboration session is active.
- Zoom controls: **Zoom out**, a percentage button that also acts as **Zoom to fit**, and **Zoom in**.

## Desktop and mobile

::: warning Designed for desktop
The ribbon, inspector, and dialogs are designed for desktop-sized screens. On a phone or small tablet the app switches to a compact toolbar and bottom sheets, and supports touch gestures (drag, pinch-to-zoom), but serious editing is easier on a larger screen.
:::

<div style="display: flex; gap: 1rem; align-items: flex-start;">
  <figure style="flex: 1;">
    <img src="/user-guide/overview-mobile-layout.jpg" alt="Mobile viewer layout" style="max-width: 280px;" />
    <figcaption>Mobile viewer</figcaption>
  </figure>
  <figure style="flex: 1;">
    <img src="/user-guide/overview-mobile-inspector.jpg" alt="Mobile inspector bottom sheet" style="max-width: 280px;" />
    <figcaption>Mobile inspector (bottom sheet)</figcaption>
  </figure>
</div>

## Where to go next

- [Viewing Presentations](/user/viewing) - navigate slides, zoom, hidden slides, and reading notes.
- [Editing Slides](/user/editing) - select and format elements, insert content, manage slides, undo, and autosave.
- [Presenting](/user/presenting) - run a slideshow, presenter view, and live annotations.
- [Exporting](/user/exporting) - save back to `.pptx`, export PDF, images, GIF, and video, and print.
- [Collaboration](/user/collaboration) - co-edit in real time and broadcast a show.
- [Keyboard Shortcuts](/user/shortcuts) - the complete shortcut reference.

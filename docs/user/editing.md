---
title: Editing Slides
description: Select, move, resize, and restyle elements; add text, shapes, images, tables, and charts; manage slides; undo/redo; find & replace; and comment.
---

# Editing Slides

This page covers changing the content of a presentation: working with elements, formatting them, managing slides, and reviewing.

::: warning Editing must be enabled
Editing is only available when the app is configured with edit mode enabled (the developer sets `canEdit`). If the toolbar shows only viewing controls and you cannot select or move elements, the app is in read-only mode. Developers: see the [Component Props](/react/props) docs.
:::

## Selecting elements

- **Click** an element on the canvas to select it. Selection handles appear around it.
- **Shift-click** additional elements to select more than one.
- **Drag a box (marquee)** across empty canvas space to select everything inside it.
- Press **Ctrl/Cmd + A** to select all elements on the slide.
- Press **Escape** to deselect and close any open menus.

When something is selected, the **inspector panel** on the right updates to show that element's properties.

![Element selected with resize handles visible](/user-guide/editing-element-selected.jpg)

## Moving, resizing, and rotating

With an element selected:

- **Move** - Drag it to a new position. Use the **arrow keys** to nudge it a little, or **Shift + arrow keys** to nudge it in larger steps.
- **Resize** - Drag any of the square handles on the element's edges or corners.
- **Rotate** - Drag the rotation handle, or set an exact angle in the inspector.

You can also type exact **position** (X/Y) and **size** (width/height) values into the inspector's element properties for precise placement.

![Dragging and resizing elements](/user-guide/editing-drag-resize.gif)

## Editing text

- **Double-click** a shape or text box to start editing its text inline. A blinking cursor appears and you can type.
- Use the **Text** toolbar tab or the inspector's **Text** panel to change font, size, colour, bold/italic/underline, alignment, line spacing, and bullets.
- Press **Ctrl/Cmd + Enter** to commit the text edit, or **Escape** to cancel it.

For table cells, double-click a cell to edit its text the same way.

![Inline text editing with cursor active](/user-guide/editing-inline-text.jpg)

## Adding new elements

Use the **Insert** toolbar tab to add elements to the current slide:

| Insert              | Notes                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------- |
| **Text box**        | A new empty text box you can type into.                                               |
| **Shape**           | Pick from a palette of preset shapes (rectangles, arrows, callouts, stars, and more). |
| **Image / Picture** | Add an image from a file.                                                             |
| **Table**           | Choose the number of rows and columns.                                                |
| **Chart**           | Insert a chart; edit its data in the inspector's chart data panel.                    |
| **SmartArt**        | Pick a SmartArt layout from the insert dialog.                                        |
| **Connector**       | Draw a line/connector between shapes.                                                 |

New elements appear on the slide ready to be moved, resized, and styled.

![Insert tab with element options](/user-guide/editing-insert-tab.jpg)

## The inspector panel (properties)

The inspector on the right is **context-sensitive** - it changes based on what you have selected:

| When you select...       | The inspector lets you change...                                           |
| ------------------------ | -------------------------------------------------------------------------- |
| **Nothing** (slide)      | Slide background, layout, and size.                                        |
| **A shape or connector** | Position, size, rotation, fill (solid/gradient/pattern/image), and stroke. |
| **A text element**       | Font, size, colour, alignment, and spacing.                                |
| **An image**             | Crop and artistic effects/filters.                                         |
| **A table**              | Cell formatting, borders, and banding.                                     |
| **A chart**              | The series data grid and chart type.                                       |
| **SmartArt**             | Node text and layout.                                                      |
| **Media**                | Playback settings, trim, and bookmarks.                                    |
| **Any element**          | Animations (entrance/emphasis/exit/motion) via the animation panel.        |
| **The slide**            | Transition type, duration, and advance settings.                           |

![Inspector panel showing element properties](/user-guide/editing-inspector-panel.jpg)

## Arranging elements

Use the **Arrange** toolbar tab (or right-click context menu) to:

- **Group / ungroup** elements so they move together.
- **Align** and **distribute** multiple selected elements.
- Change **z-order** (bring to front / send to back).

![Arrange toolbar tab](/user-guide/editing-arrange-tab.jpg)

## Undo and redo

Every edit can be undone:

- **Undo** - **Ctrl/Cmd + Z**
- **Redo** - **Ctrl/Cmd + Shift + Z** or **Ctrl/Cmd + Y**

The app captures a snapshot after each change, so you can step backward and forward through your edit history. (Continuous actions like dragging are captured once the action finishes, not on every pixel.)

## Cut, copy, paste, duplicate

| Action    | Shortcut                    |
| --------- | --------------------------- |
| Copy      | **Ctrl/Cmd + C**            |
| Cut       | **Ctrl/Cmd + X**            |
| Paste     | **Ctrl/Cmd + V**            |
| Duplicate | **Ctrl/Cmd + D**            |
| Delete    | **Delete** or **Backspace** |

See the full list on the [Keyboard Shortcuts](/user/shortcuts) page.

## Managing slides

Work with slides from the **slides panel** (left), its right-click menu, or the **Home** toolbar tab:

- **Add a slide** - Insert a new blank slide.
- **Duplicate a slide** - Copy an existing slide and its contents.
- **Delete a slide** - Remove the selected slide.
- **Reorder slides** - Drag thumbnails in the slides panel, or use the [slide sorter](/user/viewing#the-slide-sorter).
- **Hide a slide** - Keep a slide in the file but skip it during a slideshow.
- **Sections** - Group slides into named sections to organise larger decks.

## Editing speaker notes

Click into the **notes panel** below the canvas and type to add or edit the current slide's speaker notes. Notes are saved with the presentation and shown in [presenter view](/user/presenting#presenter-view) during a slideshow.

## Find and replace

Open **Find & Replace** from the **Review** or **Home** toolbar tab to search text across **all** slides at once:

1. Type the text to find.
2. Optionally enter replacement text.
3. Step through matches, or **Replace** / **Replace All**.

Regular-expression search is supported for advanced matching.

## Comments

Use the **Review** toolbar tab to work with comments:

- **Add a comment** anchored to a slide or element.
- **Reply** to build a threaded discussion.
- **Resolve** or delete comments when they are addressed.

Comment markers appear on the canvas so you can see where feedback is attached.

## Saving your work

The status bar shows whether you have **unsaved changes**. To keep your edits, save or export the file - see [Exporting](/user/exporting) for saving back to `.pptx` and other formats. Some apps also enable **autosave**.

## Next

- Present your deck: [Presenting](/user/presenting)
- Save and share it: [Exporting](/user/exporting)
- Speed things up: [Keyboard Shortcuts](/user/shortcuts)

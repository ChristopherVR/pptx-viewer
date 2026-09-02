---
title: Keyboard Shortcuts
description: The complete keyboard shortcut reference for editing, navigating, the slide sorter, and slideshows.
---

# Keyboard Shortcuts

On macOS, use **Cmd** wherever **Ctrl** is listed.

::: info Shortcuts are context-aware
Editing shortcuts work in edit mode only and are suppressed while you are typing in a text box, editing a table cell, or using a Draw tab tool, so the keys go to the text instead. Slideshow shortcuts work only while presenting, except **F5** / **Shift+F5**, which start one. **Escape** always works.
:::

::: tip In-app reference
An abbreviated shortcut list is available inside the app: **Help tab > Keyboard Shortcuts**, or **Keyboard Shortcuts** in the **"..."** overflow menu.
:::

## Editing

Active in edit mode when you are not typing into an element.

| Action                                | Shortcut                       |
| ------------------------------------- | ------------------------------ |
| Undo                                  | **Ctrl+Z**                     |
| Redo                                  | **Ctrl+Shift+Z** or **Ctrl+Y** |
| Copy selected element                 | **Ctrl+C**                     |
| Cut selected element                  | **Ctrl+X**                     |
| Paste element                         | **Ctrl+V**                     |
| Duplicate selected element            | **Ctrl+D**                     |
| Delete selected element               | **Delete** or **Backspace**    |
| Select all elements on the slide      | **Ctrl+A**                     |
| Nudge selected element                | **Arrow keys**                 |
| Nudge selected element (larger step)  | **Shift+Arrow keys**           |
| Group selected elements               | **Ctrl+G**                     |
| Ungroup selected elements             | **Ctrl+Shift+G**               |
| Open or close Find & Replace          | **Ctrl+F**                     |
| Open or close this shortcut panel     | **?** or **Ctrl+/**            |
| Deselect / close menus / stop editing | **Escape**                     |

**Ctrl+F** is the one shortcut that still works while you are typing inside an
element, matching PowerPoint: it is the shortcut people reach for with the
cursor already in a text box.

## Text editing

While typing inside an element.

| Action               | Shortcut       |
| -------------------- | -------------- |
| Commit the text edit | **Ctrl+Enter** |
| Cancel the text edit | **Escape**     |

## Navigation and view

| Action                            | Shortcut             |
| --------------------------------- | -------------------- |
| Previous slide (nothing selected) | **Left Arrow**       |
| Next slide (nothing selected)     | **Right Arrow**      |
| Zoom the canvas in / out          | **Ctrl+Mouse wheel** |

Zoom in, zoom out, and zoom-to-fit are also buttons in the status bar.

::: tip
The arrow keys do double duty in edit mode: with an element selected they nudge it; with nothing selected they change slides.
:::

## Slide sorter

Active while the slide sorter overlay is open.

| Action                                    | Shortcut                    |
| ----------------------------------------- | --------------------------- |
| Copy selected slides                      | **Ctrl+C**                  |
| Paste slides                              | **Ctrl+V**                  |
| Duplicate selected slides                 | **Ctrl+D**                  |
| Select all slides                         | **Ctrl+A**                  |
| Delete selected slides                    | **Delete** or **Backspace** |
| Zoom thumbnails in / out                  | **Ctrl +** / **Ctrl -**     |
| Collapse selection, then close the sorter | **Escape**                  |

::: info Not every sorter has every command
All five viewers answer **Escape**, **Delete** and **Ctrl+D** in the sorter. The slide clipboard
(**Ctrl+C** / **Ctrl+V**), **Ctrl+A** and the thumbnail zoom keys need a multi-selecting, zoomable
sorter, which only the React viewer currently ships; elsewhere those chords fall through to the
browser rather than doing nothing quietly.
:::

## Slideshow

Starting a show works from anywhere in the viewer, including while you are typing, and in a
read-only viewer too; the rest are active only while presenting.

| Action                            | Shortcut     |
| --------------------------------- | ------------ |
| Start the show from the beginning | **F5**       |
| Start the show from this slide    | **Shift+F5** |

::: warning F5 no longer reloads the page while the viewer has focus
These are PowerPoint's keys, and the browser's reload key. The viewer claims a plain **F5**
only when keyboard focus is inside it and no show is running; **Ctrl+F5** and the browser's
reload button are untouched.
:::

These match PowerPoint's own slideshow keys. Note the deliberate split: the annotation
tools are **Ctrl** chords, because PowerPoint gives the bare letters `N`, `P`, `B`, `W`
and `E` to navigation and screen commands.

| Action                             | Shortcut                                                                          |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| Next slide / next animation step   | **Right Arrow**, **Down Arrow**, **Page Down**, **Spacebar**, **Enter**, or **N** |
| Previous slide                     | **Left Arrow**, **Up Arrow**, **Page Up**, **Backspace**, or **P**                |
| First slide                        | **Home**                                                                          |
| Last slide                         | **End**                                                                           |
| Jump to a slide                    | Type its number, then **Enter**                                                   |
| Black screen on / off              | **B** or **.**                                                                    |
| White screen on / off              | **W** or **,**                                                                    |
| Arrow (normal) pointer             | **Ctrl+A**                                                                        |
| Laser pointer                      | **Ctrl+L**                                                                        |
| Pen                                | **Ctrl+P**                                                                        |
| Eraser                             | **Ctrl+E**                                                                        |
| Erase all annotations on a slide   | **E**                                                                             |
| Show / hide ink markup             | **Ctrl+M**                                                                        |
| Show / hide the slideshow toolbar  | **Ctrl+H**                                                                        |
| Show all slides                    | **Ctrl+S**                                                                        |
| Live captions / subtitles on / off | **J**                                                                             |
| Slideshow context menu             | **Shift+F10** or the **Menu** key                                                 |
| End the slideshow                  | **Escape** or **-**                                                               |

::: info Coverage of the two chrome chords
**Ctrl+H** (hide the slideshow toolbar) and **Ctrl+S** (Show All Slides) are recognised by the
shared slideshow keymap in every viewer, but only the React and Vue viewers currently act on
them; the other three ignore the chord rather than doing something different with it.
:::

The highlighter has no keyboard shortcut; use the slideshow toolbar. Presenter view is a
toolbar toggle too, not a key. See [Presenting](/user/presenting) for how the annotation
tools and presenter view work.

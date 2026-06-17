---
title: Presenting
description: Run a fullscreen slideshow with animations and transitions, use presenter view, annotate live, and exit cleanly.
---

# Presenting

Presentation mode turns the viewer into a fullscreen slideshow that plays your transitions and animations, with a presenter view, a timer, and live annotation tools.

## Starting a slideshow

Start presenting from the **Slide Show** toolbar tab (or the matching action in your app). The current slide expands to fill the screen and the editing chrome disappears.

::: tip
A floating slideshow toolbar lives at the bottom of the screen. It **auto-hides** after a few seconds of no mouse movement and reappears when you move the mouse (especially toward the bottom of the screen).
:::

## Navigating during a slideshow

You can advance the show by clicking or with the keyboard:

| To...                                | Do this                                                         |
| ------------------------------------ | --------------------------------------------------------------- |
| Go to the **next** slide / animation | Click, or press **Right Arrow**, **Page Down**, or **Spacebar** |
| Go to the **previous** slide         | Press **Left Arrow** or **Page Up**                             |
| **Exit** the slideshow               | Press **Escape**                                                |

The slideshow toolbar also has **previous** / **next** buttons and a slide counter (for example, `3 / 12`).

## Transitions and animations

When you move between slides, the **slide transition** assigned to each slide plays automatically - fades, pushes, wipes, reveals, and more, including **morph** transitions that animate matching elements from one slide to the next.

**Animations** on a slide play according to their triggers:

- **On click** - wait for you to click/advance before each animation runs.
- **With previous** - play at the same time as the prior animation.
- **After previous** - play automatically once the prior one finishes.

Entrance, emphasis, exit, and motion-path animations are all played back.

::: warning Fidelity notes
Transitions and animations are approximations of PowerPoint's behaviour. Morph matches elements between slides and interpolates their position, size, opacity, rotation, and colour, but does not morph between different shape geometries or intelligently morph text. Advanced timing-tree conditions are simplified during playback. See [Limitations](/guide/limitations) for the full details.
:::

## Presenter view

Presenter view splits the screen so you can see information the audience doesn't:

- **Speaker notes** for the current slide
- A **preview of the next slide**
- An **elapsed timer**

Toggle presenter view during a slideshow by pressing **N**, or using the presenter-view button on the slideshow toolbar.

## Annotating live

While presenting, you can draw on the slides to emphasise points. The annotation tools are on the slideshow toolbar, and several have keyboard toggles:

| Tool              | What it does                                              | Shortcut  |
| ----------------- | --------------------------------------------------------- | --------- |
| **Laser pointer** | A glowing dot that follows your cursor (leaves no marks). | **L**     |
| **Pen**           | Draws freehand ink in a colour you choose.                | **P**     |
| **Highlighter**   | Draws translucent highlight strokes.                      | (toolbar) |
| **Eraser**        | Removes ink strokes.                                      | **E**     |
| **Clear**         | Removes all annotations on the slide.                     | (toolbar) |

Right-click (or use the small dropdown next to) the pen or highlighter to pick a colour.

::: tip Show/hide the slideshow toolbar
Press **Ctrl + M** to toggle the slideshow toolbar on or off.
:::

## Rehearsing with timings

Some apps offer a **rehearse timings** mode, which records how long you spend on each slide as you practice. When you exit, a summary of your per-slide timings is shown so you can pace your talk.

## Exiting

Press **Escape** at any time to end the slideshow and return to the editor. (If you were rehearsing, your timing summary appears first.)

## Next

- Save a recording or handout of your deck: [Exporting](/user/exporting)
- Full key list: [Keyboard Shortcuts](/user/shortcuts)

---
title: Exporting
description: Save your edits back to .pptx, export PDF, PNG, GIF, and video, package for sharing, and print handouts and notes pages.
---

# Exporting

Everything you export is generated in your browser and downloaded to your device; nothing is uploaded anywhere. Export and save actions live in the **File** tab (the backstage), and the most common ones are repeated in the **"..."** overflow menu at the right end of the toolbar.

![File tab showing export options](/user-guide/exporting-file-menu.jpg)

## Saving back to PowerPoint

1. Click the **File** tab.
2. Click **Save** to download the presentation as a `.pptx` file, or open **Save As** for all formats:

| Save As option                 | What you get                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| **PowerPoint Presentation**    | An editable `.pptx` file with all your changes.                                            |
| **PowerPoint Show**            | A `.ppsx` file that opens directly into a slideshow.                                       |
| **Macro-Enabled Presentation** | A `.pptm` file that preserves VBA macros. Shown only when the opened file contains macros. |
| **Package for Sharing**        | A `.zip` bundle containing the `.pptx` plus a readme.                                      |

The **Save** button in the title bar does the same as **File > Save**. Saved files round-trip your edits: added and changed elements, slide order, notes, sections, and so on.

::: warning There is no Ctrl+S
Because the app runs in a browser, **Ctrl+S** triggers the browser's own page-save dialog, not a presentation save. Use the **Save** button or the File tab instead. Files always save as downloads; check your browser's download folder.
:::

## Exporting images, PDF, GIF, and video

Open **File > Export**:

| Option                     | What you get                                                          | Scope         |
| -------------------------- | --------------------------------------------------------------------- | ------------- |
| **Create PDF**             | A PDF with one page per slide, captured at high resolution.           | Whole deck    |
| **Export current slide**   | A PNG image of the current slide.                                     | Current slide |
| **Create a Video**         | A `.webm` video that plays through the deck, a few seconds per slide. | Whole deck    |
| **Create an Animated GIF** | A compact looping GIF of the deck.                                    | Whole deck    |
| **Export as JSON**         | A portable JSON document that re-imports with full fidelity.          | Whole deck    |
| **Copy as Image**          | Copies the current slide to your clipboard as an image.               | Current slide |

For whole-deck formats a progress dialog shows each slide being captured, with a **Cancel** button if you change your mind. The finished file downloads automatically.

## Printing

1. Open **File > Print** and click **Print Presentation**. A print dialog opens with a live preview.
2. Choose what to print under **Print What**: **Full Page Slides**, **Handouts** (with a slides-per-page setting), **Notes Pages** (each slide above its speaker notes), or **Outline**.
3. Set **Orientation**, **Color Mode** (Color, Grayscale, Black and White), whether to **Frame Slides**, and the **Slide Range** (All Slides, Current Slide, or a custom From/To range).
4. Click **Print**. Your browser's print window opens, where you pick the printer or save as PDF.

::: tip Notes handouts
Printing **Notes Pages** is the way to get a document that pairs each slide with its speaker notes.
:::

## Protecting and inspecting the file

The **File > Info** page offers:

- **Protect Presentation** - set a password so the saved file is encrypted.
- **Inspect Presentation** - review document properties.
- **Embed Fonts** - keep typography consistent when the file moves between devices.
- **Digital Signatures** - view signatures attached to the presentation.

## Fidelity and size notes

::: warning Raster exports are an approximation
PNG, PDF, GIF, and video exports rasterize the on-screen slide using `html2canvas`. Most content captures faithfully, but a few CSS effects are approximated during capture, so minor visual differences are possible. See [Limitations](/guide/limitations) for the complete list.
:::

::: info Very large slides
Raster exports are bounded by your browser's maximum canvas size. Extremely large slides exported at high scale may hit this limit.
:::

## Next

- Co-edit with others: [Collaboration](/user/collaboration)
- Developer export details: [/react/export](/react/export)

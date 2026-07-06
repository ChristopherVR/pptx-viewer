---
title: Exporting
description: Save and export your presentation to PNG, PDF, GIF, video, back to .pptx, and more.
---

# Exporting

You can export the current slide or the whole presentation to several formats, and save your edits back to a PowerPoint file. Export actions live in the **File** toolbar tab (look for **Export** / **Save As**).

## Available formats

| Format                  | What you get                                                                               | Scope         |
| ----------------------- | ------------------------------------------------------------------------------------------ | ------------- |
| **PNG image**           | A raster image of the current slide.                                                       | Current slide |
| **Copy as image**       | Copies the current slide to your clipboard as an image.                                    | Current slide |
| **PDF**                 | A multi-page PDF, one slide per page.                                                      | Whole deck    |
| **PDF (with notes)**    | A PDF that also lays out each slide's speaker notes, with overflow paginated across pages. | Whole deck    |
| **GIF**                 | An animated GIF that cycles through the slides.                                            | Whole deck    |
| **Video**               | A `.webm` video that plays through the slides.                                             | Whole deck    |
| **Save as PPTX**        | A standard PowerPoint file containing your edits.                                          | Whole deck    |
| **Save as PPSX**        | A PowerPoint _slideshow_ file (opens directly into a slideshow).                           | Whole deck    |
| **Save as PPTM**        | A macro-enabled PowerPoint file.                                                           | Whole deck    |
| **Package for sharing** | Bundles the presentation for sharing.                                                      | Whole deck    |

::: tip SVG export
A vector **SVG** export path is also available. Because SVG is vector-based, it avoids the rasterization limits described below and is a good choice when you need crisp, scalable output. Availability of this option depends on how your app exposes it.
:::

## How to export

1. Open the **File** toolbar tab.
2. Choose **Export** (or **Save As**) and pick a format.
3. For whole-deck formats (PDF, GIF, video), a **progress dialog** appears while each slide is captured and the file is assembled. You can **cancel** mid-way if needed.
4. The finished file downloads automatically (or, for "copy as image", lands on your clipboard).

![File tab showing export options](/user-guide/exporting-file-menu.jpg)

## Saving back to PowerPoint

Choose **Save as PPTX** to write your edits to a standard `.pptx` file that opens in Microsoft PowerPoint and other apps. This round-trips your changes - added/edited elements, slide changes, notes, and so on. Use **PPSX** if you want a file that opens straight into a slideshow, or **PPTM** for macro-enabled decks.

## Resolution and quality notes

- **PDF** is captured at higher resolution (about 2× scale) for sharp output.
- **GIF** is captured at a smaller scale to keep file size reasonable.
- **Video** records each slide for a few seconds per slide as it plays through the deck.

## Fidelity caveats

::: warning Raster exports are an approximation
PNG, JPEG, PDF, GIF, and video exports rasterize the on-screen HTML/CSS using `html2canvas`. This works well for most content, but a few CSS features aren't fully supported during capture (for example `backdrop-filter`, CSS `var()` custom properties, and CSS 3D transforms). The app preprocesses these to approximate them, but some visual fidelity can be lost.

For the crispest, most faithful output, prefer the **SVG** (vector) export where it is available. See [Limitations](/guide/limitations) for the complete list of rendering and export caveats.
:::

::: info Very large slides
Raster exports are bounded by your browser's maximum canvas size (commonly 16384×16384 or 32768×32768 pixels). Extremely large slides at high scale may hit this limit.
:::

## Next

- Co-edit with others: [Collaboration](/user/collaboration)
- Developer export details: [/react/export](/react/export)

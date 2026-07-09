# Real-world corpus

Five `.pptx` decks authored by PowerPoint itself (COM automation against a
real `PowerPoint.Application`, `SaveAs` format 24 / `ppSaveAsOpenXMLPresentation`),
not hand-built via `PresentationBuilder`. They exist so the round-trip suite in
`../../integration/real-world-corpus-roundtrip.test.ts` exercises the markup
real PowerPoint actually emits (relationship ordering, `mc:AlternateContent`
envelopes, namespace verbosity, etc.), which synthetic fixtures never do.

- **smartart-chart-table-mix.pptx** - 4 SmartArt diagrams from different
  layout families (Basic Process, Basic Cycle, Hierarchy, Basic Pyramid) plus
  a native chart and a themed table together on one slide.
- **master-layout-inheritance-fills.pptx** - a customized slide master
  (gradient background, placeholder font colour) used through 4 distinct
  custom layouts (Title Slide, Title and Content, Two Content, Section
  Header), plus shapes with two-colour gradient fills, a patterned fill, and
  theme-coloured preset shapes (diamond/triangle/cube/pentagon).
- **animations-transitions-multislide.pptx** - 5 slides, each with a distinct
  slide transition (`cut`, `fade`, `split`, `diamond`, `random`) and 3 shapes
  per slide with different entrance animations (Appear/Fly/Fade/Wipe/Zoom)
  and trigger timing (on click / with previous / after previous).
- **ole-embedded-media.pptx** - an embedded Excel worksheet and an embedded
  Word document (real OLE objects, not linked), plus an embedded video clip
  and an embedded audio clip.
- **preset-geometry-wordart.pptx** - 15 uncommon preset autoshapes (block
  arrows, callouts, stars, ribbons, explosions, wave/cloud) and two WordArt
  authoring paths: the legacy `Shapes.AddTextEffect` gallery (which, note,
  never emits `a:prstTxWarp` - it only applies styled-text formatting to a
  plain rectangle) and the modern `TextFrame2.WarpFormat` property (which
  does emit real `a:prstTxWarp` curve/arch/wave geometry).

Regenerating a fixture requires PowerPoint + COM automation on Windows; there
is no cross-platform authoring path for these files, so they are checked in
as binaries rather than generated at test time.

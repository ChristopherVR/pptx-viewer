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
- **smartart-orgchart-fan-variants.pptx** - 11 slides, one org chart each, on
  the "Organization Chart" layout (Standard hierBranch throughout): a
  systematic matrix probing the "manager row not exactly chPref wide"
  residual. Row widths 2/4/5; the chPref(3)-reaching manager placed at every
  position (first/middle/last) within its row; a 2-wide row where BOTH
  managers have 3 reports; a 4-wide row with two managers (at the two edges)
  each having 3 reports. The witness that this residual is not a
  rendering-time "fan" decision at all: `SmartArtNode.AddNode()` fills the
  CURRENT "hierChild group" wrapper (capacity `chPref`) regardless of which
  node's `.Nodes` collection the call targets, so a manager only keeps a real
  child once its own wrapper is full; earlier "reports" become the manager's
  own ROW SIBLINGS instead (already reconstructed by
  `flattenOrgChartGroupWrappers`). Re-chunking the resulting flat list
  sequentially into `chPref`-sized groups reproduces the original wrapper
  boundaries exactly (verified against all 11 slides); what was missing was
  the per-group row-vs-column choice: a group with any member that itself has
  ordinary children fans the WHOLE group inline across the shared row
  (contiguous with neighbouring groups), while a leaf-only group compacts
  into one hanging column, exactly like `smartart-orgchart-many.pptx` below.
  See `smartart-hierarchy-wrapped-groups.ts` and
  `smartart-orgchart-genuine-fixture.test.ts`.
- **smartart-orgchart-hierbranch.pptx** - 4 slides, one per
  `SmartArtNode.OrgChartLayout` value (Standard/BothHanging/LeftHanging/
  RightHanging on the "Organization Chart" layout), each a manager with an
  assistant, 3 direct reports and 2 grandchildren under the first report. The
  witness for `dgm:presLayoutVars/dgm:hierBranch` on genuine markup: it lives
  on the `presName="hierRoot1"` presentation point, not the generic first
  `presLayoutVars` container a naive scan finds.
- **smartart-orgchart-many.pptx** - one manager with 6 direct reports on the
  "Organization Chart" layout, no per-node overrides. The witness for
  `chPref`/`chMax` on genuine markup: PowerPoint groups reports past the
  layout's preferred row size (chPref=3, a layout-definition constant) into
  that many stacked hanging COLUMNS side by side, not additional fanned rows.
  Both were authored with a small resize-nudge (grow then shrink back) after
  each `SmartArtNode` edit: a COM property write does not always force
  PowerPoint to recompute the cached `dsp:` drawing by itself, and without the
  nudge the saved drawing part silently kept the pre-edit geometry.
- **smartart-orgchart-nested-hang.pptx** - 2 slides (Standard, Both Hanging) on
  the "Organization Chart" layout: a CEO with 3 direct reports, one of which
  (Report B) was given 5 of its own children via repeated
  `SmartArtNode.AddNode()` calls. The witness that `chMax`/`chPref` grouping
  does NOT recurse past generation 1: PowerPoint's `AddNode()` redirects the
  4th and 5th calls to nest under the 3rd child (a THIRD generation, "Team
  Four"/"Team Five" under "Team One") instead of adding more direct siblings
  of Report B, because the built-in layoutDef only defines named
  group-wrapper slots (`rootComposite1`/`rootComposite`/`rootComposite3`) at
  the manager's own children - there is no equivalent slot template one level
  deeper, so a genuine PowerPoint org chart cannot exceed `chPref` direct
  children below the manager. This also independently confirms the
  `hierAlign`/`alignOff` root-box offset at a THIRD generation: "Team One" ->
  "Team Four"/"Team Five" offsets by exactly the same 0.25x-box-width ratio
  measured at generation 2 in `smartart-orgchart-hierbranch.pptx`, on BOTH
  slides, and "Both Hanging" keeps a node's several children in ONE shared
  column rather than alternating sides. Authored with the same resize-nudge as
  the two fixtures above.

Regenerating a fixture requires PowerPoint + COM automation on Windows; there
is no cross-platform authoring path for these files, so they are checked in
as binaries rather than generated at test time.

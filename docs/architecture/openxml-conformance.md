---
title: OpenXML Conformance
description: The ECMA-376 / ISO/IEC 29500 conformance contract, how Strict and Transitional packages are detected, normalized, and round-tripped, and exactly which namespace families are remapped on save.
---

# Open XML conformance contract

This project targets the parts of ECMA-376 / ISO/IEC 29500 needed by a
PresentationML package. It does not claim support for standalone WordprocessingML
or SpreadsheetML documents.

## Meaning of parity

A feature is fully supported only when every applicable capability below is
verified. Preserving unknown XML is valuable, but it is not equivalent to
understanding or editing that XML.

The coverage manifest (`OPENXML_COVERAGE`, in `packages/core/src/core/openxml/`) scores every
construct on **four** facets, typed as `OpenXmlCoverageFacet`:

| Facet       | Requirement                                                                                                |
| ----------- | ---------------------------------------------------------------------------------------------------------- |
| `parse`     | Parse every conforming representation without data loss or an unreported fallback.                         |
| `preserve`  | Retain unsupported markup, relationships, content types, ordering, and package parts through a dirty save. |
| `edit`      | Expose the feature in the typed model and apply supported mutations without damaging unrelated markup.     |
| `serialize` | Emit Strict or Transitional markup that validates against the selected conformance class.                  |

Each facet is graded with an `OpenXmlCoverageLevel`: `native`, `partial`,
`passthrough`, `unsupported`, or `unassessed`.

::: warning The manifest does not score rendering
There is deliberately **no `render` facet**. The manifest is a statement about the
package-level round-trip, not about pixels: a construct can be `native` on all four
facets and still be approximated on screen. Visual fidelity is tracked separately in
[Limitations](/guide/limitations), which is the page to read for what a slide actually
looks like.
:::

## Strict vs Transitional

ISO/IEC 29500 defines two conformance classes for the markup inside a package:

- **Transitional** (ECMA-376): the form virtually every PowerPoint file uses.
  Markup namespaces live under `http://schemas.openxmlformats.org/...`.
- **Strict** (ISO/IEC 29500 Strict): the ISO-preferred subset, which Office
  2013+ can produce as "Strict Open XML Presentation". Markup namespaces live
  under `http://purl.oclc.org/ooxml/...`, and the root `p:presentation`
  element carries `conformance="strict"`.

The two classes use _different namespace URIs for the same elements_. A parser
hard-coded to Transitional URIs sees a Strict file as unrecognisable markup,
which is why many libraries fail on Strict files outright. `pptx-viewer`
supports both classes bidirectionally.

### What happens on load

Strict handling is implemented in
`packages/core/src/core/utils/strict-namespace-map.ts` and wired into the
runtime's state module:

1. `detectStrictConformance()` inspects the namespace declarations
   (`xmlns` / `xmlns:*`) on the parsed presentation root. Any
   `http://purl.oclc.org/ooxml/...` URI marks the file as Strict.
2. `normalizeStrictXml()` rewrites the already-parsed tree **in place**,
   converting namespace declarations, relationship `Type` attributes, and
   extension `uri` attributes to their Transitional equivalents.
3. The XML parser is wrapped in a Proxy so every subsequent `parse()` call in
   the entire load pipeline transparently normalizes its result. The rest of
   the codebase (all element parsers, theme resolution, chart parsing, and so
   on) only ever sees Transitional URIs and needs no Strict-awareness.
4. The detected class is recorded on the model as
   `data.conformance: 'strict' | 'transitional'`.

### What happens on save

`save()` accepts a conformance option:

```ts
const bytes = await handler.save(data.slides, {
	conformance: 'preserve', // default: match the loaded file
	// conformance: 'strict',       // force Strict output
	// conformance: 'transitional', // force Transitional output
});
```

- `'preserve'` (the default) uses the conformance class detected at load time,
  so a Strict file loaded, edited, and saved comes back out as Strict without
  any option being set.
- When the effective class is `'strict'`, the final step of the save pipeline
  (`convertZipToStrictConformance()`) re-parses every `.xml` and `.rels` part
  in the archive, applies `convertXmlToStrict()` in place (namespace
  declarations, relationship types, extension URIs), and sets
  `conformance="strict"` on the `p:presentation` root as the Strict schema
  requires. Parts that fail to parse (binary content with an `.xml`
  extension) are left unchanged; the conversion is best-effort per part.
- Conformance-dependent save constants (relationship types, namespaces used by
  the writers) are selected up front from the effective class, so newly
  authored parts are born in the right form rather than translated afterwards.

## What gets remapped, and what stays canonical

Only the **markup-language families** defined by ISO/IEC 29500-1 are remapped
between conformance classes. This matches the authoritative translation table
the Open XML SDK applies when opening a Strict package.

| Family                                                                                                    | Remapped?           | Example Strict URI                                              | Example Transitional URI                                                    |
| --------------------------------------------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `presentationml`                                                                                          | Yes                 | `http://purl.oclc.org/ooxml/presentationml/main`                | `http://schemas.openxmlformats.org/presentationml/2006/main`                |
| `drawingml` (main, chart, diagram, picture, ...)                                                          | Yes                 | `http://purl.oclc.org/ooxml/drawingml/chart`                    | `http://schemas.openxmlformats.org/drawingml/2006/chart`                    |
| `officeDocument` (incl. its relationship-type URIs, math, bibliography, doc properties)                   | Yes                 | `http://purl.oclc.org/ooxml/officeDocument/relationships/image` | `http://schemas.openxmlformats.org/officeDocument/2006/relationships/image` |
| `spreadsheetml` (embedded chart workbooks)                                                                | Yes                 | `http://purl.oclc.org/ooxml/spreadsheetml/main`                 | `http://schemas.openxmlformats.org/spreadsheetml/2006/main`                 |
| `wordprocessingml` (embedded documents)                                                                   | Yes                 | `http://purl.oclc.org/ooxml/wordprocessingml/main`              | `http://schemas.openxmlformats.org/wordprocessingml/2006/main`              |
| `schemaLibrary`                                                                                           | Yes                 | `http://purl.oclc.org/ooxml/schemaLibrary/main`                 | `http://schemas.openxmlformats.org/schemaLibrary/2006/main`                 |
| `descriptions`                                                                                            | Yes (distinct host) | `http://purl.oclc.org/ooxml/descriptions/base`                  | `http://descriptions.openxmlformats.org/description/base`                   |
| Open Packaging Conventions (`package/*` content types, relationships, core-properties, digital-signature) | **No**              | canonical in both classes                                       | canonical in both classes                                                   |
| Markup Compatibility (`markup-compatibility/2006`)                                                        | **No**              | canonical in both classes                                       | canonical in both classes                                                   |

::: warning OPC and MCE are conformance-independent
The Open Packaging Conventions (ISO/IEC 29500-2) and Markup Compatibility and
Extensibility (ISO/IEC 29500-3) are shared specifications, independent of the
conformance class. Real Office "Strict Open XML" files keep OPC relationship
types and the `mc:` namespace in their canonical
`schemas.openxmlformats.org` form even though the markup inside the parts uses
Strict `purl.oclc.org` namespaces. Remapping them would produce files that
neither Office nor the spec accepts, so `pptx-viewer` deliberately leaves them
untouched in both directions.
:::

### The structural derivation rule

Beyond an explicit table of well-known pairs, the mapping exploits the fact
that Strict and Transitional URIs in the remapped families are related by a
deterministic rule, not an arbitrary lookup:

```
Strict:        http://purl.oclc.org/ooxml/<family>/<tail...>
Transitional:  http://schemas.openxmlformats.org/<family>/2006/<tail...>
```

The host swaps and a `2006` version segment is inserted after the family
segment. `pptx-viewer` derives pairs algorithmically for any URI in a remapped
family, so a Strict-only relationship type or DrawingML sub-namespace that is
not explicitly enumerated still normalises on load and converts back on save.
(`descriptions` is the one remapped family that breaks the rule, with its own
transitional host, so it lives in the explicit map only.)

## Round-trip guarantees

- **Strict in, Strict out.** Loading a Strict file records
  `data.conformance === 'strict'`; saving with the default `'preserve'`
  emits Strict namespaces and `conformance="strict"` again.
- **Lossless internal normalization.** Normalization happens on namespace
  URIs only; element structure, ordering, attributes, and unknown markup are
  untouched, so Strict handling composes with the passthrough save behaviour.
- **Explicit conversion both ways.** `conformance: 'strict'` and
  `conformance: 'transitional'` convert a package to the other class,
  without rewriting the conformance-independent OPC and MCE namespaces.
- **Verified against real package structure.** The behaviour is exercised by
  unit tests on the mapping itself (`strict-namespace-map.test.ts`) and by an
  integration round-trip suite
  (`packages/core/src/__tests__/integration/strict-conformance-roundtrip.test.ts`)
  whose packages mirror the structure of genuine Office-authored Strict files,
  including the canonical OPC namespaces those files keep.

## Conformance gates

Full PresentationML parity requires all of these gates:

1. Official ECMA-376 Strict and Transitional schemas validate every generated
   package and every dirty-save corpus result.
2. Open Packaging Conventions checks cover part names, content types,
   relationships, external targets, compression, and Markup Compatibility.
3. The compatibility API reports every preserve-only, fallback, lossy, or
   unsupported construct with a stable code and XML location.
4. `mc:Choice` is selected from verified feature capabilities, not merely from
   recognition of a namespace prefix.
5. Real PowerPoint-authored corpus tests force dirty serialization and compare
   package structure, typed semantics, and reference renders.
6. Strict-to-Transitional and Transitional-to-Strict conversions validate in
   both directions without rewriting conformance-independent namespaces.
7. No coverage-manifest facet remains `partial`, `passthrough`, `unsupported`,
   or `unassessed` before a full-parity claim is published.

## Scope families

The coverage manifest must include:

- Open Packaging Conventions and document properties
- Presentation structure, slides, masters, layouts, notes, handouts, comments,
  tags, sections, custom shows, views, and presentation properties
- DrawingML geometry, text, colour, fill, line, effect, transform, lock, media,
  theme, and table vocabularies
- Classic charts, extended charts, chart drawings, and embedded workbooks
- DiagramML / SmartArt data, layout, colour, style, and cached drawings
- Timing trees, build lists, transitions, triggers, sounds, and media timing
- Pictures, SVG, ink, content parts, OLE, ActiveX, VML, 3D models, and extensions
- Markup Compatibility and Microsoft PresentationML extension namespaces
- Strict and Transitional conformance classes

## Evidence policy

Unit tests prove individual mappings. Synthetic package tests prove writer
composition. Real-file dirty-save tests prove interoperability. Schema
validation proves structural conformance. No single evidence class is accepted
as proof of parity by itself.

## Extension-namespace and schema-edge attributes

Two constructs look like gaps until you check what the base schema actually
declares:

**Transition duration is legitimately extension-namespace, not missing.**
`CT_SlideTransition` (S19.3.1.50, transitional schema) declares only `spd`,
`advClick`, and `advTm` attributes; there is no `dur` attribute for a slide
transition's duration in milliseconds anywhere in the base PresentationML
schema. PowerPoint itself needs that value, so it writes it in the Office 2010
extension namespace instead, as `p14:dur`. COM-verified (PowerPoint 2016,
`Slide.SlideShowTransition.Duration = 2.5` via `Presentations.Add` +
`SaveAs(ppSaveAsOpenXMLPresentation)`): PowerPoint wraps the whole
`p:transition` element in `mc:AlternateContent`, writing
`<mc:Choice Requires="p14"><p:transition spd="slow" p14:dur="2500" .../></mc:Choice><mc:Fallback><p:transition spd="slow" .../></mc:Fallback>`.
PowerPoint does not merely tolerate a bare `dur` attribute, it silently
ignores it: a package with only `dur="2000"` reopens at PowerPoint's 0.5s
default (COM-verified). `pptx-viewer` writes `p14:dur` too
(`packages/core/src/core/core/runtime/slide-transition-duration-ns.ts`), but
declares it via a simpler `mc:Ignorable="p14"` on the slide root rather than
wrapping every transition in `mc:AlternateContent`; PowerPoint accepts both
forms and honours the duration either way (COM-verified). A reader that
understands neither form falls back to the `spd` speed keyword, which is why
`spd` is still written alongside `p14:dur` in both PowerPoint's own output and
`pptx-viewer`'s.

**`p:animEffect/@filter="image"` names a filter with no backing payload.**
`ST_TLAnimateEffectFilter` (19.5.5) enumerates the SMIL-style filter families
`p:animEffect`'s `@filter` attribute can name, and `image` is one of them, but
`CT_TLAnimateEffectBehavior` (19.5.3) gives the element no child or attribute
that could carry a second, separately authored image reference. A filter
value of `image` names an image-based wipe/mask transition with no schema
slot, anywhere in the timing tree or its relationships, for which image to
use, so no conforming reader (PowerPoint included) can recover the intended
filter. `pptx-viewer` treats it the same as the other filter families it has
no bespoke render for: a neutral fade fallback.

**`p:bldP/p:tmplLst` is an authoring-time template, not a playback input.**
`CT_TLTemplateList` (19.5.84) and its `p:tmpl` entries (`CT_TLTemplate`,
19.5.85) let a text build declare a per-outline-level timing default. Per
`packages/core/src/core/services/animation-timing-templates.ts` (which parses
and round-trips these typed but deliberately does not feed them into
playback), the semantics are that PowerPoint clones a template's `p:tnLst`
only to seed timing for an outline level that does not yet have its own
instantiated node, i.e. while a user is actively adding a new bullet in the
Animation Pane. Any paragraph actually present and visible in a saved file
already has its own explicit node under `p:timing/p:tnLst` for whatever level
it authors at (PowerPoint materialises one per currently-used level before
save), so there is no level in a legitimately saved deck that only the
template covers. This is corroborated by the real-PowerPoint-authored corpus
(`anatidae-animation.pptx`, exercised by
`animation-build-templates-surgical-roundtrip.test.ts`) and the full-rebuild
round-trip test, but was not re-verified with a fresh COM `CreateVideo`
capture: constructing a file where a currently-used level lacks its own node
would require hand-editing the timing tree directly, and PowerPoint's
`DisplayAlerts`-suppressed loader is known to silently repair a malformed
package (see `scripts/pptx-com-open.ps1`), which would make any observed
"template ignored" result unreliable evidence either way.

## Group re-wrap and edit order

Positions and sizes are exposed as whole pixels (9,525 EMU per pixel), with the
exact source EMU kept alongside (`xEmu`/`yEmu`/`widthEmu`/`heightEmu`). An
unmoved element, and an unmodified group at any nesting depth (its own
placement, `a:chOff`/`a:chExt`, and every child), re-emit their source
`a:off`/`a:ext`/`a:chOff`/`a:chExt` byte-for-byte on save, whatever child-space
convention the file used. Resizing a group directly keeps its child space and
every child byte-identical, matching PowerPoint (COM-verified).

Moving or resizing a child keeps the group's original child space (untouched
siblings stay byte-identical) and, like PowerPoint's own bounding-box
auto-fit, tightly re-wraps the group's own `a:chOff`/`a:chExt` and
`a:off`/`a:ext` around the new set of children, propagating up through every
enclosing ancestor whose own box changed as a result. This is COM-verified
byte-exact for: a plain move; a rotated child (rotation alone has no effect,
matching PowerPoint); a rotated group (the fixed rotation pivot is
reproduced); nested-group propagation; an unrotated group resized directly
AND having a child edited in the same save; a ROTATED group resized directly
AND having a child moved+resized in the same save; and a rotated shape that
is itself a direct child of a group, resized (not moved), including when
width and height are BOTH resized together in one edit, COM-verified
byte-exact across 25 / 37 / -40 / 61 / 113 / 155 / 200 / 290 degrees.
Matching PowerPoint here requires composing the rotation-aware resize as two
sequential per-axis corrections, width then height, each re-anchored against
the previous step's result, not one simultaneous rotation.

A directly resized ROTATED group (no child touched) is byte-exact too: COM
ground truth across 25 / 90 / 180 / -40 degrees, `Shape.Width`/`Height`
(together or separately), and `ScaleWidth` from the top-left or from the
middle, all match one rule: the resize keeps a single anchor point (the
untouched edge, or the exact centre for a middle-anchored scale) fixed on
screen once rotated, which the save path reproduces by moving `a:off`
accordingly. The same fix and COM verification cover a plain (non-group)
rotated shape resized directly, including both axes together in one edit
(same sequential-correction fix, same 8-angle sweep).

The one remaining non-right-angle gap is a ROTATED group resized directly AND
having a child moved and/or resized in the SAME save. A COM sweep settled two
things: first, the group's own resize committing BEFORE the child's edit and
its tight re-wrap (matching this SDK's single-final-state save path) is the
only order reachable at all; the reverse order diverges from it by up to
71,000 EMU (about 0.08 inch, visibly, not a rounding difference), because
PowerPoint live-refits the group's box the instant a child changes, so
whichever edit happens second composes against an already-refit intermediate
box. A save built from one final element tree cannot recover which of a
user's two separate actions happened first, so that reverse order is not a
target this fix chases. Within the reachable order, an 8-angle x 3-edit-combo
(child moved, resized, moved+resized: 24 cases) sweep is byte-exact in 9 of
24 cases; the rest land up to 2 EMU (2/914400 inch) off COM ground truth on
one or more of `a:off`'s x/y or `a:ext`'s width/height, with no consistent
sign or axis. This residual is distinct from the sequential-correction fix
above: applying that fix to this case's own self-resize step changes none of
the 24 numbers (verified); further decomposing the tight re-wrap step itself
the same way makes it worse (6/24); carrying the intermediate centre as an
unrounded float through the whole chain scores 5/24 (and breaks an
already-exact unrotated case); single-precision trig throughout changes
nothing at all. `a:ext`'s height drifting in several cases, a value with no
rotation term in this formula at all, pointed at PowerPoint computing this
specific combination through a different internal path rather than a
rounding-order fix reachable from black-box outputs.

A follow-up COM experiment (commit `dc6692eba`) proved this rather than
merely suspecting it: holding a child's FINAL position/size fixed and varying
only the ORDER `GroupItems(1).Left`/`Top`/`Width`/`Height` are assigned (same
four target values, one COM session, one save) changes the group's own saved
`a:ext` by up to 589,402 EMU (0.64 inch) at 200 degrees, and by 115,531 EMU
on `cy` alone at 25 degrees (`1029931` vs `914400`); both orderings are
individually byte-reproducible, and neither one is "more correct" than the
other. PowerPoint refits the group's bounding box after EACH property
assignment, not once per logical edit, so this specific combined case has no
single correct answer to converge on: it has as many byte-exact answers as
there are orderings a user could have entered the four numbers in, and a save
built from one final element tree has no order to replay. The 9/24-exact,
<=2 EMU sweep above (pinned against one such ordering's ground truth) is
therefore already about as tight as a single-final-state save architecture
can get; closing it to 0 for that one ordering would not generalise to any
other equally valid one. See `group-tight-rewrap-own-box.ts` for the full
investigation and proof, and `group-tight-rewrap.test.ts`'s `grp1st` sweep
and order-sensitivity case for the COM-pinned numbers.

## `.ppt` export ceiling

`save(slides, { outputFormat: 'ppt' })` writes a real MS-PPT/OfficeArt record stream in an OLE2 (CFB) container (`packages/core/src/core/ppt/writer/`), not a stub. It round-trips slide count, shape geometry, text/run formatting, pictures, groups, tables (as PowerPoint 2003's own grouped-rectangle model) and backgrounds losslessly, both plaintext and RC4 CryptoAPI password-protected (`pptPassword`); a from-scratch deck built purely through the SDK opens in real PowerPoint 16.0 over COM with matching slide/shape counts and text (COM-verified, `scripts/com-acceptance-ppt.mjs`).

**Done, COM-verified:**

- Shape- and run-level hyperlinks/click-actions: a URL, a specific-slide jump, every relative jump (next/previous/first/last slide, end show, last slide viewed), a named custom show, `mailto:`, and Open File/Open Presentation, verified against `ActionSettings(ppMouseClick)`.
- An embedded OLE object (`oleEmbeddedData`) is written as a genuine Windows "OLE Package" object (`CompObj`/`Ole10Native` inside a nested OLE2 storage, verified as `OLEFormat.ProgID === "Package"` / `msoEmbeddedOLEObject`) whenever a PNG/JPEG preview is available. The importer reads it back too: `ExOleEmbedContainer`/`ExOleObjStg` (`packages/core/src/core/ppt/ole-embed-parser.ts`) parses into an editable `ole` element, verified against a real PowerPoint-authored `.ppt` carrying a native `Excel.Sheet.8` embed (`e2e/fixtures/ole-embed-excel.ppt`, authored via `scripts/make-ole-embed-excel-fixture.ps1`'s `Shapes.AddOLEObject`, measured `OLEFormat.ProgID` = `"Excel.Sheet.8"`), whose recovered bytes decode (via this project's own BIFF8 reader) to the exact cell values PowerPoint wrote.
- Embedded audio (WAV) is written as a real, playable `SoundCollectionContainer`/`SoundDataBlob` (`media-writer.ts`), which goes further than PowerPoint 16.0 itself: PowerPoint's own "Save as PowerPoint 97-2003" keeps only the `SoundContainer` shell (`Shape.MediaFormat.Length` reads 0, no `RIFF` bytes anywhere), while this writer's audio re-exports byte-identical to the source WAV when PowerPoint itself re-saves as `.pptx`.
- Video is not embedded, but PowerPoint 16.0 cannot embed video into 97-2003 either (an attempted embed collapses to a static picture, `Shape.Type` = `msoPicture`, on save), so this writer's existing picture/placeholder degradation already matches PowerPoint's own ceiling. A genuinely linked (external file path) video is a distinct, unimplemented capability a bytes-in/bytes-out `save()` API has no destination directory to link against.
- Ink, SmartArt, charts and 3D models are additionally written with a `metroBlob` (`packages/core/src/core/ppt/writer/metro-blob-package.ts`): the same [MS-ODRAW] `OfficeArtTertiaryFOPT` mini-package (opid `0x03A9`) real PowerPoint 2007+ writes into a 97-2003 file, holding the element's own OOXML (a `p:contentPart` for ink; a renamed `p:graphicFrame`/`p:E2oFrame` for SmartArt, charts and a synthesised 3D-model frame) so a PowerPoint 2007+ reader reopens the shape as the native, editable object it was, while a genuinely 97-2003-era reader still sees this writer's rasterised preview picture or placeholder rectangle. The OOXML is sourced from this handler's own lossless `.pptx` save of the same slides, so an edited element round-trips its current state, not the state it was loaded with (`PptxHandlerRuntimeSaveLegacyPpt.ts`'s `resolveMetroBlobs`). COM-verified by reopening from-scratch `.ppt` output in PowerPoint 16.0: ink reads back `Shape.Type` = 23/`msoInk`, matching PowerPoint's own 97-2003 SaveAs exactly; SmartArt reads back `Shape.HasSmartArt` = `True` with the same 11 nodes and text intact; a chart reads back `Shape.HasChart` = `True`, `ChartType` = 5/`xlPie`, with its title and series values exact; and a 3D model reads back `Shape.Type` = 30/`msoModel3D` as a working `Model3D` object. For charts and 3D models this exceeds PowerPoint's own 97-2003 SaveAs ceiling (see the next two bullets): PowerPoint itself degrades both to something inert on its own 97-2003 save, while this writer's `.ppt` output reopens either as the live, editable object in PowerPoint 2007+. A degraded element that carries a `metroBlob` is flagged with an info-level `ppt-native-roundtrip-<type>` compatibility warning instead of the plain `ppt-unsupported-<type>` warning, since the fallback picture/placeholder is now a 97-2003-only limitation, not a loss (`degrade-element.ts`).
- 3D models still rasterise to a plain picture for a genuinely 97-2003-era reader (`Shape.Type` = 13/`msoPicture`, no `OLEFormat`), matching PowerPoint 16.0's own 97-2003 SaveAs behaviour exactly (measured with `scripts/measure-model3d-ole-97.ps1`, which builds a minimal spec-valid binary glTF in-script and inserts it via `Shapes.Add3DModel`); a PowerPoint 2007+ reader instead reopens the `metroBlob` above as a native `Model3D` object.
- Charts still rasterise to a picture for a genuinely 97-2003-era reader too. PowerPoint 16.0 keeps a modern chart as an embedded `Excel.Chart.8` OLE object (legacy MS Graph) on 97-2003 SaveAs instead (measured with `scripts/measure-chart-ole-97.ps1`: `Shape.Type` = 7/`msoEmbeddedOLEObject`, `OLEFormat.ProgID` = `"Excel.Chart.8"`, `Shape.HasChart` = `False`). Writing a real `Excel.Chart.8` object for that 97-2003-only path is not planned: unlike `ExOleObjStg` ([MS-PPT]/[MS-ODRAW]-documented and already implemented above), the legacy MS Graph chart's internal binary layout has no public Microsoft specification to verify against; the `metroBlob` above sidesteps the problem entirely for any PowerPoint 2007+ reader by carrying the real modern chart part instead.
- The pre-CryptoAPI Office 95 RC4/XOR obfuscation scheme is not supported on import. Import fidelity is bounded by the format predating DrawingML: there is no theme font scheme to carry over (the converter synthesizes one named "Imported PPT" from the deck's first collected font, falling back to Arial), and effects with no binary equivalent are degraded. Every degraded element is flagged with a `save`-scoped `PptxCompatibilityWarning`.

**Remaining `.ppt` gaps:** an image whose source is not PNG or JPEG is written as a placeholder rectangle rather than a picture, since `raster-utils.ts` only decodes those two formats into a `.ppt`-embeddable blip; master-level text-style overrides (`p:titleStyle`/`p:bodyStyle`/`p:otherStyle`) are not written; video and any embedded audio format other than WAV degrade to a picture (see above); and encrypted `.ppt` import supports RC4 CryptoAPI only, not the pre-CryptoAPI Office 95 scheme (also above).

**How the `metroBlob` was found.** Unlike charts, video and 3D models, PowerPoint 16.0 keeps ink and SmartArt genuinely native across its own 97-2003 round trip, so this writer's earlier picture-only degradation of them did not match PowerPoint's own ceiling. Ink was measured against a real PowerPoint-authored fixture with genuine `p14:` ink content (`e2e/fixtures/ink-contentpart.pptx`, `scripts/measure-ink-ole-97.ps1`): every ink shape read back unchanged as `Shape.Type` = 23/`msoInk`. SmartArt was measured against a real, COM-authored fixture (`packages/core/src/__tests__/fixtures/corpus/smartart-orgchart-many.pptx`, `scripts/measure-smartart-ole-97.ps1`): `Shape.HasSmartArt` read `True` before and after (`Shape.Type` = 24/`msoDiagram`).

A from-scratch reproduction attempt (2026-09-11) reverse-engineered both saved files (via this project's own `ole2-parser-read.ts` and `record-stream.ts` readers) and found PowerPoint represents both as an ordinary MSOSPT 75 ("Picture Frame") shape whose `OfficeArtTertiaryFOPT` carries exactly one complex property, undocumented id `0x3A9` (raw bytes `A9 C3`, i.e. `fComplex`+`fBlipId` set), holding a raw ZIP/OPC "mini-package": a real `[Content_Types].xml`/`_rels` structure with undocumented but genuine content types (`application/vnd.ms-office.DrsInk+xml`, `application/inkml+xml`, `application/vnd.ms-office.DrsE2oDoc+xml`, `application/vnd.ms-office.DrsDownRev+xml`). For ink, the package's `drs/inkxml.xml` is a `p:contentPart` byte-identical to the source's own `p14:contentPart`, plus a byte-identical `drs/ink/ink1.xml`. For SmartArt, `drs/e2oDoc.xml` is a `p:E2oFrame` (a renamed `p:graphicFrame`/`dgm:relIds`) plus all five diagram parts this core already round-trips losslessly, entirely self-contained. (This corrects an earlier assumption that a document-level `RoundTripCustomTableStyles12Atom`, `0x428C`, was involved; it turned out to hold only a generic `tableStyles.xml` round-trip unrelated to either feature. Ink and SmartArt use the same `0x3A9` property id.)

At the time, writing that same property (a byte-exact copy of this project's own generated package, including PowerPoint's own captured bytes spliced in unmodified on one test) onto an MSOSPT 75 shape in a from-scratch `.ppt` did **not** reproduce `Shape.Type` = `msoInk`/`msoDiagram`: a COM re-open read back `Shape.Type` = 13/`msoPicture` (with a `pib` blip reference) or 1/`msoAutoShape` (without one). This was tested exhaustively for ink, independently varying the exact FOPT property table, the exact `ClientAnchor` position (from the source's own `p14:xfrm`), and the shape's ordinal position among 1-3 siblings, without ever producing `msoInk`. The conclusion at the time was that the mini-package alone was insufficient and that at least one more, unidentified signal was required.

That "impossible" conclusion missed something simpler than a missing signal: record ORDER. PowerPoint's own shape container writes `OfficeArtTertiaryFOPT` between `FOPT` and `ClientAnchor`; every earlier attempt, following [MS-PPT]'s informal `SpContainer` ordering, wrote `ClientAnchor` immediately after `FOPT` and appended `TertiaryFOPT` afterwards. Moving it to sit between the two, in `buildShapeContainer` and `buildPictureContainer` (`shape-writer.ts`), was the missing piece: PowerPoint now accepts the mini-package and reopens the shape as the native object it describes (commits `b370d429d`, `e1e43448a`). The same investigation caught two adjacent bugs a real reopen would otherwise have hit immediately afterwards: `ClientAnchor`'s 16-byte form orders its fields left/top/right/bottom, not top/left/right/bottom as an earlier reading of [MS-PPT]'s `RectStruct` assumed (a probe shape written the old way reopened transposed; `anchor-writer.ts` now also prefers the 8-byte `SmallRectStruct` form PowerPoint itself always writes when every edge fits), and a drawing's background shape must be `OfficeArtDgContainer`'s own trailing sibling shape carrying `fBackground | fHaveSpt`, not a member of the top shape group (`drawing-writer.ts`, `sp-container.ts`). Charts and 3D models were then wired onto the same `metroBlob` mechanism (`metro-blob-xml.ts`, `metro-blob-source.ts`, `metro-blob-model3d.ts`) since a modern chart or 3D model has no binary-`.ppt` representation of its own either; see "Done, COM-verified" above for the reopen numbers.

One unrelated, COM-verified fix also came out of this investigation: the `wzName` OfficeArt complex property (a shape's `name`) was missing its trailing UTF-16 null terminator, which made real PowerPoint reject outright any `.ppt` this writer produced for a named shape ("Office has detected a problem with this file", no repair option). Fixed in `fopt-writer.ts`'s `encodeComplexString`, with a byte-level regression test.

## SmartArt layout ground truth

When a `.pptx` carries PowerPoint's own pre-computed drawing part, that exact layout is used, placed at its raw offsets the way PowerPoint places it (verified live over COM). Otherwise a DiagramML interpreter (all ten `dgm:alg` types, `constrLst`/`ruleLst` including `dgm:choose`-gated entries, relative constraints, `presLayoutVars`) rebuilds it.

That interpreter is measured against a 229-fixture gallery of every built-in layout (all 176 that `Application.SmartArtLayouts` reports) authored by PowerPoint itself over COM (`packages/core/src/__tests__/integration/smartart-gallery-ground-truth.test.ts`, opt-in via `SMARTART_GALLERY_GATE=1` and skipped by default until it is green). The gate compares the interpreter's own output (`computeSmartArtElementsWithoutCache`, which never reads the cache) against the fixture's cached `dsp:drawing`, shape by shape, matched by node text.

`computeSmartArtElementsWithoutCache` actually runs two independent engines behind that one function: a legacy family-based interpreter (`smartart-layout-interpreter.ts`, one arranger chosen for the whole diagram) and a per-point DiagramML engine (`smartart-engine/`, which executes each layoutDef `layoutNode`'s own algorithm/constraints per data point). `scripts/measure-smartart-engine-vs-legacy.ts` runs both independently against every fixture to find layouts where the engine is strictly more accurate on every dataset with no shape-set loss; `smartart-engine/engine-first-allowlist.ts` lists the `layoutDefinition.uniqueId`s that measurement found (e.g. "Gear": legacy 76% deviation vs. engine 0.1%, because the legacy composite arranger cannot reach Gear's rotated/decorative named-slot children at all), and `computeDiagramMlElements` tries the engine first only for those, legacy first everywhere else, falling back to the other on decline either way.

Measured 2026-09-24 (re-run with `SMARTART_GALLERY_GATE=1`; per-fixture numbers in `smartart-gallery/baseline.json`, regenerated by `scripts/gen-smartart-gallery-baseline.ts`):

| Check                                                          | Fixtures passing |
| -------------------------------------------------------------- | ---------------- |
| Same set of text-bearing shapes as PowerPoint                  | 227 of 229       |
| ...and every shape's x/y/w/h within 1% of the diagram's bounds | 87 of 229        |
| ...within 5%                                                   | 110 of 229       |
| ...within 10%                                                  | 121 of 229       |
| ...within 50%                                                  | 180 of 229       |
| Same shape preset on every matched shape                       | 204 of 229       |
| Same font size on every matched shape                          | 25 of 229        |
| Full gate (all of the above at 1%)                             | 11 of 229        |

The two structural misses are `segmented-process--hier5` (a `linDir="fromB"` stack whose items switch between two composite templates by `revPos`, rendered as one row of folded boxes) and `bubble-picture-list--hier5` (a preset-specific blank separator paragraph). By gallery category, the share within 1% is: matrix 3/3, pyramid 7/10, cycle 10/17, hierarchy 11/23, relationship 15/35, list 15/40, process 19/48, picture 7/27, and 0 for timeline (7), Meet the Team (6) and Text Card (13).

Two waves against `engine-first-allowlist.ts` produced these numbers. First, introducing the allowlist (55 layouts) moved geometry-within-1% from 39/229 to 82/229 (within-5% 59->105, within-10% 72->117, within-50% 155->178, preset 190->204, font 24->25) with 0 regressions (`gen-smartart-gallery-baseline.ts --compare`). Second, a fix in `engine-to-result.ts`'s `hideGeom` handling (ECMA-376 21.4.7.16: `hideGeom` means no visible border/fill, not "not a node" - the engine previously dropped every such node outright, losing item-role-split shapes like a child's own text rendered as a second, borderless box under a sibling's card) recovered `vertical-action-list--hier5` (1/5 matched shapes before, 5/5 after) and `descending-block-list--hier5` (1/5 -> 5/5), moving both onto the allowlist (57 layouts from that fix; 60 total after also re-measuring the rest of the corpus caught `opposing-ideas`, `theme-picture-accent` and `theme-picture-alternating-accent` newly qualifying too) for a further 82->87 geometry-within-1% with, again, 0 regressions and the full gate moving 10->11. `numbered-title-list`/`numbered-card-list` hit a DIFFERENT, deeper bug the same fix does not touch (their layoutDef folds a child node's text into its parent's presentation node instead of giving the child its own box, dropping 3 of 6 shapes) and remain legacy-first; this is a tracked, open gap, not a silent workaround. The full gate is still mostly blocked by preset or font-size mismatches unrelated to either fix.

Third, the engine gained a `snake` algorithm (`smartart-engine/alg-snake.ts`, ECMA-376 21.4.2.x: children fill a grid picked from the node's own aspect ratio or a fixed `bkpt="fixed"` line length, honouring `flowDir`/`contDir`/`grDir`/`off`, mirroring the legacy `arrangeSnake`'s grid math but leaving each cell's own subtree to size itself through the engine's ordinary constraint/font-fit pipeline). Re-measuring against it qualified 7 more layouts for the allowlist (67 total) with, again, 0 regressions; none crossed the within-1%/5%/10%/50% bands on their own (they are still-inaccurate picture/composite families), but one, Icon Circle Label List, went from 4971% legacy deviation to 64% engine deviation.

Fourth, the engine gained a `cycle` algorithm (`smartart-engine/alg-cycle.ts`, ECMA-376 21.4.2.x: `stAng`/`spanAng` place children evenly around a ring, `ctrShpMap="fNode"` pulls the first content point off the ring to a centred hub, `rotPath="alongPath"` rotates each ring item to the path's own tangent; the ring radius solves the adjacent-item chord the same "natural unit space, then a single isotropic contain-fit" way the legacy `computeCycleRingLayout` does, but reads the ring's own `sibSp` gap as the DECLARED constraint's `fact` rather than the generic constraint pipeline's already-solved value - a real gallery layoutDef's `sibSp` commonly resolves `refFor="ch" refType="w"` against a ring item's own "wish" width, which an earlier `for="ch"` constraint in the same list has already set to the WHOLE diagram's width, so the solved value is `fact * diagramWidth`, not `fact`). Re-measuring against the 17-fixture cycle/radial family qualified no new layouts for the allowlist: the three already listed (Cycle Matrix, Segmented Cycle, Radial Picture List) are unaffected (identical deviation, since their own datasets do not exercise the new `cycle` code path), Basic and Multidirectional Cycle now tie the legacy interpreter exactly instead of falling back to it (a tie, not an improvement, so not added), Block/Continuous/Nondirectional Cycle and Radial Cycle come out measurably worse under this simplified ring-only model (no hub-satellite gap ratio, `sibTrans` bulge or asymmetric axis-flush centring), and Text Cycle, Hexagon Radial, Basic/Diverging Radial, Radial Cluster, Converging Radial and Radial List still decline outright (composite ring items or a hub construction this pass does not model). None of this moves the gate numbers: 0 regressions (`gen-smartart-gallery-baseline.ts --compare`), since none of these layouts were engine-first before or after. `pyra`, `hierRoot` and `hierChild` remain unimplemented in the per-point engine (`registry.ts` still substitutes `composite` for them, caught by `isFullySupported` so the engine declines cleanly rather than emitting silently-wrong geometry): each is a substantial, genuinely different algorithm family (the legacy interpreter's own `pyramid`/`hierarchy` arrangers together are still several thousand lines) that would need its own from-scratch per-point port, not attempted in this pass.

Fifth, before attempting `pyra`, a unit-conversion bug in `constraint-eval.ts` was found and fixed: real "Basic Pyramid"/"Inverted Pyramid" layoutDefs declare their `level` (and `acctBkgd`/`acctTx`) composite child with a bare, unit-free `ctrX`/`w` (and `ctrY`/`h`) literal pair - `<dgm:constr type="w" for="ch" forName="level" val="1"/>` beside `<dgm:constr type="ctrX" for="ch" forName="level" val="1"/>` - which the engine's general "bare literal is a millimetre length" rule collapsed to a ~2.83pt box (measured: engine deviation 3.212 vs. legacy 0.0019 on `basic-pyramid--flat3`). No single absolute-length reading of `val="1"` can produce "fill the box" (`ctrX = w` places it from `w/2` to `3w/2` under any uniform conversion), so, COM-verified, this specific `ctrX`/`w` (or `ctrY`/`h`) bare-literal pairing is now read as a fraction of the declaring node's own already-resolved size instead (`constraint-fill-idiom.ts`), matching the legacy family interpreter's own independently-derived `resolveRatioConstraint` convention. Scanning the whole 229-fixture corpus for that exact pairing finds it ONLY in the two pyramid layouts, so the fix is scoped to them by construction; an earlier, broader attempt (treating every bare `w`/`h`/`ctrX`/`ctrY`/... literal this way) regressed Gear (0.0882 -> declined), Segmented Cycle (0.0012 -> 0.3959), Varying Width List (0.654 -> 0.7982) and Vertical Chevron List (0.3996 -> declined), because those layouts use the SAME-looking bare `val="1"` for a genuinely tiny, real anchor-point marker (e.g. Gear's `gear1srcNode`/`gear1dstNode`, `hideGeom="1"` connector endpoints) rather than this idiom; the narrowed, paired-literal-only fix reproduces the exact pre-change measurement on all 229 fixtures (`measure-smartart-engine-vs-legacy.ts` and `gen-smartart-gallery-baseline.ts --compare` both byte-identical to the prior run: still 87/229 geometry within 1%, 11/229 full gate), since `pyra` itself is not yet in the engine's `SUPPORTED_ALGS` and so still declines the pyramid layouts outright; the fix has no measurable effect until `pyra` is implemented, at which point it is the difference between the band filling its slot and collapsing to a point.

What does hold: the core single-algorithm layouts (Basic Process, Vertical Process, Basic Block List, Basic/Continuous/Multidirectional Cycle, Basic and Diverging Radial, Hierarchy, Horizontal Hierarchy, Basic and Inverted Pyramid, and Organization Chart apart from its three-level `hier8` dataset at 2.3%) reproduce PowerPoint's geometry within 1% on every dataset in the corpus, though not always its exact font size. Text autofit follows the measured rules (whole-point sizes, the real frame margins and rounded-corner insets, a fixed 0.78 ratio for folded child paragraphs), and org charts are additionally pinned by `smartart-orgchart-genuine-fixture.test.ts` (topology, hanging-tail offset, fan-vs-column choice).

Still open: most multi-template layouts (picture, timeline, Meet the Team, Text Card, and the composite list/process families) are placed by the family-level arrangers rather than by executing each layoutDef's per-point `dgm:choose` and composite constraints, so 74 of 229 fixtures deviate by more than 50% of the diagram size and font sizes rarely match exactly. This only affects decks saved without the cached drawing; PowerPoint itself writes one, so it applies to decks from other generators and to live re-layout after a structural edit.

## Related reading

- [Limitations](/guide/limitations) - the current honest gap list.
- [Architecture](/guide/architecture) - where conformance handling sits in the load and save pipelines.

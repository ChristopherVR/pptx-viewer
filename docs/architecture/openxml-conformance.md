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

## Related reading

- [Limitations](/guide/limitations) - the current honest gap list.
- [Architecture](/guide/architecture) - where conformance handling sits in the load and save pipelines.

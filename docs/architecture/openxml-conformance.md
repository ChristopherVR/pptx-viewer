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

## Related reading

- [Limitations](/guide/limitations) - the current honest gap list.
- [Architecture](/guide/architecture) - where conformance handling sits in the load and save pipelines.

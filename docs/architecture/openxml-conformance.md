# Open XML conformance contract

This project targets the parts of ECMA-376 / ISO/IEC 29500 needed by a
PresentationML package. It does not claim support for standalone WordprocessingML
or SpreadsheetML documents.

## Meaning of parity

A feature is fully supported only when every applicable capability below is
verified. Preserving unknown XML is valuable, but it is not equivalent to
understanding or editing that XML.

| Capability | Requirement                                                                                                |
| ---------- | ---------------------------------------------------------------------------------------------------------- |
| Consume    | Parse every conforming representation without data loss or an unreported fallback.                         |
| Preserve   | Retain unsupported markup, relationships, content types, ordering, and package parts through a dirty save. |
| Render     | Reproduce the feature without a material semantic or visual fallback.                                      |
| Edit       | Expose the feature in the typed model and apply supported mutations without damaging unrelated markup.     |
| Produce    | Emit Strict or Transitional markup that validates against the selected conformance class.                  |

Each feature in the coverage manifest is classified independently as `full`,
`partial`, `preserve-only`, or `unsupported` for these capabilities.

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
7. No coverage-manifest entry remains `partial`, `preserve-only`, or
   `unsupported` before a full-parity claim is published.

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

# OpenXML / ECMA-376 Parity Roadmap

Status: drafted 2026-05-05 from a multi-agent audit covering DrawingML text, shapes/geometry, fills/lines/effects, colors/theme, presentation structure, tables, charts/embeds, and OPC packaging.

This document is the canonical worklist to bring `pptx-viewer-new` to full ECMA-376 parity. Findings are grouped by structural pattern, then enumerated as actionable items, then organized into five execution phases ordered by impact-to-effort.

---

## Cross-cutting structural defects

These three patterns produce most of the visible round-trip regressions. Fix them at the codec layer and many individual findings disappear.

### CC-1. Save-side color flattening

`PptxColorTransformCodec` preserves scheme-color identity on parse, but `PptxHandlerRuntimeSaveShapeStyleWriter.ts:42-110` always emits `<a:solidFill><a:srgbClr val="…"/></a:solidFill>`. `lnRef`/`fillRef`/`effectRef` are resolved into concrete styles at load time and never re-emitted. Net effect: every accent-bound shape becomes hex-locked; PowerPoint _Recolor_ / _Reset_ / Quick Styles no longer apply.

### CC-2. Schema child-ordering violations

fast-xml-parser preserves _insertion_ order. The save layer mutates parsed objects by key assignment without a final reorder pass. Concrete violations:

| Element          | Wrong order produced                                          | Required order                                                                                |
| ---------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `a:effectLst`    | `outerShdw → innerShdw → glow → softEdge → reflection → blur` | alphabetical: `blur, fillOverlay, glow, innerShdw, outerShdw, prstShdw, reflection, softEdge` |
| `a:tcPr` borders | `lnT, lnB, lnL, lnR`                                          | `lnL, lnR, lnT, lnB, lnTlToBr, lnBlToTr`                                                      |
| `a:spPr`         | `effectLst` and `scene3d/sp3d` post-appended after `extLst`   | `xfrm → geom → fill → ln → effectLst → scene3d → sp3d → extLst`                               |
| `a:blipFill`     | multiple writers touch independently                          | `blip → srcRect → (tile XOR stretch)`                                                         |

There is no central reorder pass anywhere.

### CC-3. Wrong attribute / element names (silent data loss)

Three concrete bugs where the code writes/reads non-spec names:

- `hOverflow` vs `horzOverflow` on `a:bodyPr` — `text-body-properties-parser.ts:260` and `PptxHandlerRuntimeSaveTextWriter.ts:71`. Real files use `horzOverflow`; parser drops it, writer emits an unknown attribute.
- `<a:tcMar><a:marL w="…"/>…</a:tcMar>` invented wrapper vs direct attributes on `<a:tcPr>` — `PptxHandlerRuntimeSaveTableStyles.ts:171-194`, `table-cell-fill-border-helpers.ts:203-232`. PowerPoint silently ignores; **all cell margins written by this library are lost on reload**.
- `a:tblStyle@val` (read) vs `a:tableStyleId` (written) — `PptxTableDataParser.ts:60-63` reads the legacy form, `save-table-merge-helpers.ts:90-92` writes the spec form. **Round-trip through this library loses the table style ID** — every saved table reverts to the default style on reload.

### CC-4. AlternateContent envelope dropped on dirty save

Slide spTree resolution merges the `mc:Choice` branch into spTree without preserving the `mc:Fallback` for legacy renderers. `p:contentPart` is mis-bucketed into `<p:sp>` on dirty slides, producing schema-invalid XML.

---

## High-severity findings (16)

### Text (DrawingML §21.1)

- **T-H1** Wrong attribute name `@_hOverflow` — see CC-3.
- **T-H2** `assembleParagraphXml` (`PptxHandlerRuntimeSaveParagraphHelpers.ts:201`) hard-codes `endParaRPr: { '@_lang': 'en-US' }` — every paragraph's end-properties overwritten with a stub.
- **T-H3** `<a:br>` parsed into `\n`, then split into separate `<a:p>` on save — soft line breaks become hard paragraph breaks, re-triggering bullets.
- **T-H4** `<a:r>` and `<a:fld>` written under separate keys → all runs collapse before all fields, breaking date / slide-number positioning.
- **T-H5** `<a:fld @id>` (required GUID per CT_TextField) only emitted when present — schema-invalid output for SDK fields.
- **T-H6** Paragraph `@_lvl` parsed for inheritance lookups but never stored on the paragraph or serialized — **all nested-list level information is lost**.
- **T-H7** `style.textFillNone` (`<a:rPr><a:noFill/>`) has no save branch — outline-only text reverts to filled.
- **T-H8** `a:bodyPr/@rot` (text-body rotation independent of shape) never parsed.

### Shapes & geometry (§20.1.9)

- **G-H1** `customGeometryPathsToXml` (`custom-geometry.ts:249-264`) emits empty `gdLst/ahLst/cxnLst/rect`. Editing a custGeom and saving wipes adjustment handles, connection sites, and text rect.
- **G-H2** Path-level `@_fill` (`norm/lighten/lightenLess/darken/darkenLess/none`), `@_stroke`, `@_extrusionOk` ignored. Multi-path callouts collapse.
- **G-H3** `connector-geometry.ts:104-225` ignores `flipH/flipV` semantics — connectors render in the wrong direction in preview.

### Fill / Line / Effects (§20.1.8)

- **E-H1** `effectLst` child order wrong — see CC-2.
- **E-H2** `effectDag` parsed in detail but `PptxShapeEffectXmlBuilder` has no `buildEffectDagXml` — edits silently dropped.
- **E-H3** Solid fill loses scheme color and transforms — see CC-1.
- **E-H4** Outer/inner shadow drop `sx, sy, kx, ky, algn`; inner shadow drops `rotWithShape`; reflection drops `fadeDir, sx, sy, kx, ky, algn, rotWithShape, stPos`.
- **E-H5** `prstShdw` parsed and stored but no write path — round-trips as a generic `outerShdw`.
- **E-H6** Miter `@_lim` hardcoded to `800000` on save, never parsed.

### Colors & theme (§20.1.4)

- **C-H1** Save flattens to `srgbClr` — see CC-1.
- **C-H2** Style refs (`lnRef`/`fillRef`/`effectRef`) not round-tripped — see CC-1.
- **C-H3** `theme.xml` is **never** emitted by the main save pipeline. Round-trip works only because the original ZIP entries pass through. Any in-memory mutation to theme is silently dropped.
- **C-H4** `applySlideMasterColorMap` mutates `themeColorMap` permanently and only reads `masterFiles[0]`. Multi-master decks resolve scheme colors against the wrong map.
- **C-H5** Master shapes drawn through a layout don't see the layout's `clrMapOvr`.

### PresentationML structure (§19)

- **P-H1** `PptxSlideMaster.txStyles` declared in the type but **no parser populates it**. Master `titleStyle/bodyStyle/otherStyle` cascade invisible to the engine.
- **P-H2** Notes-slide round-trip is text-only. Extra shapes/images/background on notes slides are dropped.
- **P-H3** `<p:hf>` parsed only at the _presentation root_ — which the schema doesn't allow. Master/layout/notesMaster/handoutMaster/slide locations never read.
- **P-H4** Animation/timing modeled only as opaque `rawTiming`; no typed walk of build trees.

### Tables (§21.1.3)

- **TB-H1** `tableStyleId` parser/writer name mismatch — see CC-3.
- **TB-H2** `tcPr` border ordering — see CC-2.
- **TB-H3** `tcMar` invented wrapper — see CC-3.
- **TB-H4** Cell `blipFill`, `noFill`, `grpFill` not parsed (only solidFill/gradFill/pattFill).
- **TB-H5** SDK skeleton `tblPr` emits `="0"` flags pre-cleanup; relies on a later pass to remove them.

### Charts & embedded objects

- **CH-H1** OLE has no XML round-trip path — `PptxHandlerRuntimeSaveElementWriter.ts:74-84` has no `case 'ole'`. Edits to `oleProgId/oleName/oleClsId/previewImage` silently dropped; SDK-created OLE elements can't be saved at all.
- **CH-H2** Ink elements re-encoded as custGeom shapes — pressure data, pen/highlighter/eraser tool metadata, per-stroke style all lost; not the OOXML ink format.
- **CH-H3** Ink graphicFrame URI (`…/2010/ink`) not detected in `PptxGraphicFrameParser.parseGraphicFrameType` — typed `unknown`.
- **CH-H4** `p:contentPart` falls into `collectors.shapes`, then assigned to `spTree['p:sp']` — produces schema-invalid output.

### Packaging (OPC, ECMA-376 Part 2)

- **PK-H1** First-time `docProps/custom.xml` write is orphan — no Content_Types Override, no root rel.
- **PK-H2** `xmlns:a16` declared on the leaf `a16:colId` instead of the part root, and `mc:Ignorable` not updated.
- **PK-H3** SDK-created decks: adding a notes slide produces an invalid package — no notesMaster, no notesSlide content-type override, no notesSlide rels file.
- **PK-H4** External-target hyperlink detection regex only recognizes `https?:|mailto:|ftp:|file:`. Other valid schemes (`tel:`, `ms-teams:`, `skype:`) lose `TargetMode="External"`.

---

## Selected medium-severity findings

### Text & runs

- Run properties skip `@altLang`, `@smtId`.
- `buFontTx` / `buClrTx` / `buSzTx` (inherit-from-text bullets) never parsed.
- Only 8 of ~30 auto-number bullet types implemented in the formatter.
- Latin/EA/CS font `@panose`, `@pitchFamily`, `@charset` ignored.
- `extLst` not preserved on `a:bodyPr`, `a:pPr`, `a:rPr`, `a:endParaRPr`.

### Fills / lines / effects

- `gradFill` `@flip`, `@rotWithShape`, `@scaled` not round-tripped; `tileRect` not parsed.
- `blipFill` retains only 5 of 13 spec image effects (`alphaMod`, `alphaInv`, `clrRepl`, `lum`, `tint`, `hsl`, `fillOverlay`, `blur` not handled). `<a:blip>@cstate` never round-tripped.
- `pattFill@prst` round-tripped as opaque string; not validated against the 53-value enum.
- `softEdge` rad ≤ 0 dropped on save.
- `custDash` missing-segments fallback emits invalid `200000` values (>100000 max).

### Colors & theme

- Theme `fontScheme` reads only Latin script; CJK / Arab / Hebr / Thai / Indic per-script overrides lost.
- Theme `objectDefaults`, `extraClrSchemeLst`, `custClrLst` not parsed.
- Color transforms: `gamma` / `invGamma` missing; transform application order doesn't match document order; HSL/RGB transforms batched.
- `phClr` outside style-ref context falls back to `accent1` silently.
- Two parallel color parsers (`color-utils.ts` legacy vs `PptxColorTransformCodec`) — drift risk.

### Presentation structure

- `CT_Presentation` attributes (firstSlideNum, serverZoom, etc.) survive only via opaque round-trip; not on typed API.
- `slideSizeType` is stringly-typed.
- Layout `type/preserve/userDrawn/showMasterSp/showMasterPhAnim` read on load, never written from typed values.
- Notes-master / handout-master save is background-only.
- Custom shows lose `extLst` on rebuild.

### Tables

- Corner-cell style sections (`seCell/swCell/neCell/nwCell`) never parsed.
- `<a:tcBdr>` (cell borders inside `tableStyles.xml`) and `<a:fillRef>` not parsed.
- `tblPr@rtl`, `tcPr@anchorCtr`, `tcPr@horzOverflow` not handled.
- Inline `<a:tableStyle>` (CT_TableStyle child of `tblPr`) not parsed.
- `tcTxStyle` only reads `fontRef→schemeClr`; `srgbClr/sysClr` text colour and `a:fontRef` typeface attributes lost.

### Charts & embedded

- Chart save mutates only series + chart-type tag + a few axis fields; edits to axes (numFmt, scaling, tickLblPos), surfaces, dataTable, trendlines, errBars, marker, dataLabels, legend, palette silently dropped.
- SmartArt save round-trips only `dgm:ptLst` + `dgm:cxnLst`.
- SmartArt `r:cs` reused for both colors and drawing-shapes binding (collision).
- `cx:` chartex extensions: layout types detected by substring; chart-type swap aborts silently for cx kinds.

### Packaging

- `Override` cleanup keys only on `init.slideContentType` — orphan content-type entries from foreign producers accumulate.
- SDK-built `p:presentation` root omits `xmlns:mc`, `xmlns:p14`, `xmlns:p15`.
- `applyMediaDefaults` adds but never removes orphan extension Defaults.
- Layout/master added at runtime: no rels file written → PowerPoint rejects.

---

## Execution phases

Each phase has two work streams (A and B) that can be executed in parallel without file conflicts. Phases must be executed in order — Phase 2 depends on Phase 1's reorder utility; Phase 4 depends on Phase 2's color preservation.

### Phase 1 — Quick wins (mechanical, low risk)

**Stream A — Naming bugs & paragraph fixes**

1. Rename `@_hOverflow` → `@_horzOverflow` in `text-body-properties-parser.ts` and `PptxHandlerRuntimeSaveTextWriter.ts`. Add a back-compat read-only fallback that accepts both on parse during the transition.
2. Teach `PptxTableDataParser.ts:60-63` to read `<a:tableStyleId>` (current spec form). Keep the legacy `<a:tblStyle val="…">` and `@_tblStyle` fallbacks for older inputs.
3. Stop hard-coding `endParaRPr: { '@_lang': 'en-US' }` in `PptxHandlerRuntimeSaveParagraphHelpers.ts:201`. Preserve parsed end-paragraph properties on the model and re-emit verbatim.
4. Store `a:p/@_lvl` on the paragraph model and re-emit it (`PptxHandlerRuntimeShapeParagraphContentParsing.ts` parse, `PptxHandlerRuntimeSaveParagraphHelpers.ts` `buildParagraphPropertiesXml` save).

**Stream B — Schema-order utility & table fixes** 5. Add a single utility `reorderObjectKeys(obj, schemaOrder)` in `packages/core/src/core/utils/`. Wire it into:

- `PptxHandlerRuntimeSaveEffectsWriter.ts` for `a:effectLst`
- `PptxHandlerRuntimeSaveShapeXml.ts` for `a:spPr`
- `PptxHandlerRuntimeSaveTableStyles.ts` for `a:tcPr` (borders order)
- blipFill writer for `a:blipFill`

6. Drop the invented `<a:tcMar>` wrapper. Write `marL/marR/marT/marB` as direct attributes on `<a:tcPr>` (`PptxHandlerRuntimeSaveTableStyles.ts:171-194`, `table-cell-fill-border-helpers.ts:203-232`).

### Phase 2 — Color identity round-trip

**Stream A — Preserve color XML**

1. Add `originalColorXml` (or equivalent serializable representation) to every fill/stroke style location, mirroring what `PptxGradientStyleCodec` already does for stops.
2. On save, when the original is present and unchanged, re-emit it verbatim. When changed, emit canonical srgb form (current behaviour).
3. Cover: solid fill, gradient stops (already done), line color, shape style refs, run properties fill, table cell fill.

**Stream B — Style refs & clrMap** 4. Persist `<a:lnRef>`, `<a:fillRef>`, `<a:effectRef>` indices and override-color XML on the shape model. Re-emit them in `<p:style>`. 5. Stop mutating `themeColorMap` permanently in `applySlideMasterColorMap`. Move `clrMap` resolution to color-resolution time. Per-master maps for multi-master decks. 6. Apply layout `clrMapOvr` to master shapes drawn via the layout (`PptxHandlerRuntimeLayoutElements.ts:48-52` push/pop currently scoped to layout elements only).

### Phase 3 — Embedded element round-trips

**Stream A — OLE & ink**

1. Add `case 'ole'` to `processSlideElement` in `PptxHandlerRuntimeSaveElementWriter.ts`. Build `p:graphicFrame > a:graphic > a:graphicData uri="…/ole" > p:oleObj` from typed `OlePptxElement` (progId, clsId, name, embedded vs linked, preview image rel).
2. Detect ink graphicFrame URI (`http://schemas.microsoft.com/office/drawing/2010/ink`) in `PptxGraphicFrameParser.parseGraphicFrameType`. Round-trip the original `aink:ink` rawXml. Stop re-encoding ink as custGeom in `PptxHandlerRuntimeSaveShapeXml.ts:62-163`.

**Stream B — contentPart & AlternateContent** 3. Add a `contentPart` collector slot in `SlideShapeCollectors`. Emit at `spTree['p:contentPart']`, not `['p:sp']`. 4. Preserve `mc:AlternateContent` envelope on dirty save: re-wrap the selected branch into `mc:Choice` + `mc:Fallback` for slide spTrees and grpSp.

### Phase 4 — Theme & inheritance correctness

**Stream A — Theme write & per-script fonts**

1. Implement `theme.xml` writer in the main save pipeline (currently only the SDK builder writes one). Round-trip parsed `themeColorMap`, `themeFontMap`, `themeFormatScheme`.
2. Parse and serialize per-script font scheme (`<a:font script="Hans|Hant|Arab|Hebr|Thai|…"/>`).
3. Parse `objectDefaults` (spDef/lnDef/txDef) and use them as the final fallback in inheritance.

**Stream B — Master/layout structure & cell types** 4. Parse master `txStyles` (titleStyle, bodyStyle, otherStyle — each a CT_TextListStyle with defPPr+lvl1pPr…lvl9pPr). Wire into the inheritance chain and serialize. 5. Move `<p:hf>` parser from the wrong root location to master/layout/notesMaster/handoutMaster/slide. Hook the "show footer" UI toggle to it. 6. Parse cell `blipFill`, `noFill`, `grpFill` in `table-cell-fill-border-helpers.ts:21-90`. 7. Parse corner-cell style sections (`seCell/swCell/neCell/nwCell`) in `PptxHandlerRuntimeTableStyles.ts:242-263`. 8. Parse `<a:tcBdr>` (cell border styles inside `tableStyles.xml`) and `<a:fillRef>` (theme matrix ref) inside `tcStyle`.

### Phase 5 — Depth and breadth

**Stream A — Effects, charts, custGeom**

1. Effect attribute completeness: `sx, sy, kx, ky, algn, rotWithShape` across shadow / reflection.
2. `prstShdw` writer in `PptxShapeEffectXmlBuilder`.
3. `effectDag` writer (round-trip the rich `dag*` fields, not just original raw XML).
4. Chart write-back of all parsed fields (axes, surfaces, trendlines, errBars, marker, dataLabels, legend, colorPalette, colorMethod). Currently series-data-only.
5. Extend `CustomGeometryPath` type to carry `gdLst`, `ahLst`, `cxnLst`, `rect`. Round-trip through `customGeometryPathsToXml`. Path-level `@fill` / `@stroke` / `@extrusionOk`.

**Stream B — SmartArt, runs/fields, packaging, misc** 6. SmartArt write-back for chrome / colorTransform / quickStyle / drawingShapes. Fix `r:cs` collision (separate `relIds['@_r:cs']` for colors vs drawing-shapes binding). 7. Unified ordered child list for paragraph children (`a:r`, `a:br`, `a:fld`) — serialize from a single sequence rather than three separate keys. 8. Group transform: compose parent rotation/flip when transforming children (`PptxHandlerRuntimeGroupParsing.ts:51-76`). 9. Connector flipH/flipV semantics (`connector-geometry.ts:104-225`). 10. External-target scheme detection: switch to "anything not a relative path" rather than a fixed protocol allowlist. 11. Add Override on first `docProps/custom.xml` write (`PptxDocumentPropertiesUpdater.ts:213-229`). 12. Move `xmlns:a16` declaration to slide root and update `mc:Ignorable`. 13. SDK new-presentation builder: include `xmlns:mc`, `xmlns:p14`, `xmlns:p15` on `p:presentation` root; create notesMaster on first notes-slide add. 14. Run properties: `@altLang`, `@smtId`. Latin/EA/CS font `@panose`, `@pitchFamily`, `@charset`. 15. Bullet `buFontTx`, `buClrTx`, `buSzTx`. Remaining ~22 auto-number formatter cases. 16. `gradFill` `@flip`, `@rotWithShape`, `@scaled`, `tileRect`. Full `blipFill` image-effect coverage. `<a:blip>@cstate`. 17. Color transforms: document-order application, `gamma` / `invGamma`. Eliminate the legacy `color-utils.ts` parallel parser. 18. Tables: `tblPr@rtl`, `tcPr@anchorCtr`, `tcPr@horzOverflow`, inline `<a:tableStyle>`, `tcTxStyle` srgbClr/sysClr/fontRef typeface attrs.

---

## Per-area parity scores (qualitative, pre-roadmap)

| Area                    | Parse                 | Save (rebuild)                                      | Round-trip                                              |
| ----------------------- | --------------------- | --------------------------------------------------- | ------------------------------------------------------- |
| Text                    | Good                  | Several gaps (lvl, lang, br/fld)                    | Lossy on edit                                           |
| Shapes/geometry         | Strong                | Weak for custGeom edits                             | Strong via passthrough; weak otherwise                  |
| Fills/lines/effects     | Strong                | Many writers missing/partial                        | **Lossy — color identity, prstShdw, dag, effect attrs** |
| Colors & theme          | Strong breadth        | **Save flattens to srgb; theme.xml never written**  | **Theme break**                                         |
| Presentation structure  | Good                  | Good for known parts                                | Strong via passthrough; lossy for txStyles/notes/hf     |
| Tables                  | Mixed                 | **Three name bugs make output un-readable by self** | **Self-incompatible**                                   |
| Charts                  | Strongest parser      | Series-only writer                                  | Good via passthrough; lossy on edit                     |
| SmartArt                | Good (data + drawing) | ptLst/cxnLst only                                   | Good via passthrough; lossy on edit                     |
| OLE / Ink / contentPart | Mixed                 | **Missing or wrong**                                | **Broken on dirty save**                                |
| Packaging               | Good                  | Mostly good; SDK gaps for notes                     | Strong; orphan custom.xml on first add                  |

---

## Files of greatest interest

Save-side (where most fixes will land):

- `packages/core/src/core/core/runtime/PptxHandlerRuntimeSaveShapeStyleWriter.ts` — color flattening (CC-1)
- `packages/core/src/core/core/runtime/PptxHandlerRuntimeSaveEffectsWriter.ts` — effect ordering, prstShdw, effectDag
- `packages/core/src/core/core/runtime/PptxHandlerRuntimeSaveTableStyles.ts` — tcMar wrapper, border ordering
- `packages/core/src/core/core/runtime/PptxHandlerRuntimeSaveParagraphHelpers.ts` — endParaRPr stub, run/field ordering, lvl
- `packages/core/src/core/core/runtime/PptxHandlerRuntimeSaveTextWriter.ts` — horzOverflow
- `packages/core/src/core/core/runtime/PptxHandlerRuntimeSaveElementWriter.ts` — missing OLE/contentPart cases
- `packages/core/src/core/core/runtime/PptxHandlerRuntimeSaveShapeXml.ts` — ink-as-custGeom, spPr ordering
- `packages/core/src/core/core/runtime/save-table-merge-helpers.ts` — tableStyleId
- `packages/core/src/core/geometry/custom-geometry.ts` — gdLst/ahLst/cxnLst dropping

Theme/color:

- `packages/core/src/core/core/runtime/PptxHandlerRuntimeThemeLoading.ts` — color-map mutation, master[0]-only
- `packages/core/src/core/core/runtime/PptxHandlerRuntimeThemeRefResolution.ts` — refs flattened

Parsers:

- `packages/core/src/core/core/builders/PptxTableDataParser.ts` — tableStyle@val (legacy)
- `packages/core/src/core/utils/text-body-properties-parser.ts` — hOverflow, no rot
- `packages/core/src/core/core/builders/PptxGraphicFrameParser.ts` — ink URI not recognized

# OpenXML PresentationML Gap Analysis

**Date:** 2026-03-07
**Spec Reference:** ECMA-376 5th Edition (ISO/IEC 29500) - PresentationML
**Codebase:** pptx-viewer monorepo (packages/core, packages/react, packages/emf-converter)

---

## Executive Summary

This document catalogs the gaps between the ECMA-376 OpenXML PresentationML specification and the pptx-viewer implementation. The codebase has **extensive coverage** of the spec, including 14 element types, 100+ preset shapes, 50+ animation presets, 40+ transitions, 20+ chart types, full SmartArt support, rich text formatting, theme handling, 3D effects, and comprehensive load/save round-trip capabilities.

The gaps identified below represent areas where spec features are missing, incomplete, or have no implementation.

---

## Coverage Summary

| Spec Area | Status |
|-----------|--------|
| Presentation structure (slides, masters, layouts) | COMPLETE |
| Shape elements (sp, grpSp, cxnSp, pic, graphicFrame) | COMPLETE |
| Text formatting (paragraphs, runs, bullets, tabs) | COMPLETE |
| Fill types (solid, gradient, pattern, blip, group) | COMPLETE |
| Line/stroke properties | COMPLETE |
| Effects (shadow, glow, reflection, soft-edge, blur) | COMPLETE |
| 3D effects (extrusion, bevel, camera, lighting, materials) | COMPLETE |
| Theme (color scheme, font scheme, format scheme) | COMPLETE |
| Preset geometry (100+ shapes with guides) | COMPLETE |
| Custom geometry (freeform paths) | COMPLETE |
| Connectors (straight, bent, curved) | COMPLETE |
| Tables (styling, merging, bands) | COMPLETE |
| Charts (20+ types, trendlines, error bars, axes) | COMPLETE |
| SmartArt (10+ layout categories, editing) | COMPLETE |
| Images (effects, crop, artistic effects, duotone) | COMPLETE |
| Media (audio, video, trim, bookmarks, captions) | COMPLETE |
| OLE objects (Excel, Word, PDF, Visio, MathType) | COMPLETE |
| Ink / Content Parts | COMPLETE |
| Animations (50+ presets, native OOXML round-trip) | COMPLETE |
| Transitions (40+ types including p14 extensions) | COMPLETE |
| Comments (legacy + modern threaded) | COMPLETE |
| Document properties (core, app, custom) | COMPLETE |
| Embedded fonts (deobfuscation, format detection) | COMPLETE |
| Digital signatures (detection, stripping) | COMPLETE |
| Encryption detection | COMPLETE |
| Custom shows | COMPLETE |
| Sections | COMPLETE |
| Drawing guides | COMPLETE |
| View properties | COMPLETE |
| Hyperlinks and actions | COMPLETE |
| Notes slides / Notes master / Handout master | COMPLETE |
| OMML Math equations | COMPLETE |
| Auto-numbered bullets | COMPLETE |
| Tab stops | COMPLETE |
| Zoom objects (slide/section zoom) | COMPLETE |
| EMF/WMF metafile rendering | COMPLETE |
| **VML legacy shapes** | **GAP** |
| **Strict OOXML conformance** | **GAP** |
| **mc:AlternateContent fallback** | **GAP** |
| Custom XML data parts | COMPLETE |
| Photo album metadata | COMPLETE |
| **Write protection (modifyVerifier)** | **GAP** |
| **Customer data tags (custDataLst)** | **GAP** |
| **External linked data sources** | **GAP** |

---

## Gap Details

### GAP-1: VML Legacy Shape Support
- **Status:** NOT STARTED
- **Priority:** HIGH
- **Spec Reference:** ECMA-376 Part 4 - Vector Markup Language (VML)
- **Impact:** Older .pptx files (pre-Office 2010) may contain VML shapes (`v:shape`, `v:rect`, `v:oval`, `v:line`, `v:group`, `v:roundrect`, `v:polyline`, `v:arc`) in fallback content or as primary shapes. These are silently dropped.
- **What's needed:**
  - Parse VML shape elements from slide XML
  - Convert VML geometry to DrawingML-equivalent representation
  - Map VML fill/stroke/text to existing PptxElement types
  - Handle `v:group` containers
  - Handle VML text boxes (`v:textbox`)
- **Files likely affected:**
  - `packages/core/src/core/core/runtime/PptxHandlerRuntimeSpTreeParsing.ts`
  - `packages/core/src/core/core/runtime/PptxHandlerRuntimeElementParsing.ts`
  - New: VML parser utility
- **Agent:** TBD
- **Notes:** —

### GAP-2: Strict OOXML Conformance
- **Status:** NOT STARTED
- **Priority:** HIGH
- **Spec Reference:** ECMA-376 Part 1, §2.1 (Conformance Classes)
- **Impact:** Office 365 can save files in "Strict Open XML" mode which uses different namespace URIs (e.g., `http://purl.oclc.org/ooxml/...` instead of `http://schemas.openxmlformats.org/...`). These files fail to parse because namespace lookups don't match.
- **What's needed:**
  - Map Strict namespace URIs to Transitional equivalents
  - Handle both `r:` relationship namespace variants
  - Update content type matching for Strict variants
  - Handle Strict-only date format (ISO 8601) vs Transitional
  - Handle Strict color value format differences (percentages vs fixed values in some contexts)
- **Files likely affected:**
  - `packages/core/src/core/core/runtime/PptxHandlerRuntimeLoadPipeline.ts`
  - `packages/core/src/core/services/PptxXmlLookupService.ts`
  - XML namespace constants
- **Agent:** TBD
- **Notes:** —

### GAP-3: mc:AlternateContent Fallback Handling
- **Status:** NOT STARTED
- **Priority:** HIGH
- **Spec Reference:** ECMA-376 Part 3 - Markup Compatibility and Extensibility
- **Impact:** Modern Office versions wrap newer features (p14/p15/p16 extensions) in `mc:AlternateContent` blocks with `mc:Choice` and `mc:Fallback`. If the parser doesn't understand the Choice namespace, it should use the Fallback. Currently, some `mc:AlternateContent` blocks may be silently skipped.
- **What's needed:**
  - Detect `mc:AlternateContent` elements during shape tree parsing
  - Check if `mc:Choice` namespace/requires is understood
  - Fall back to `mc:Fallback` content when Choice is not supported
  - Register understood extension namespaces (p14, p15, p16r3, etc.)
  - Handle nested AlternateContent blocks
- **Files likely affected:**
  - `packages/core/src/core/core/runtime/PptxHandlerRuntimeSpTreeParsing.ts`
  - `packages/core/src/core/core/runtime/PptxHandlerRuntimeElementParsing.ts`
  - `packages/core/src/core/services/PptxXmlLookupService.ts`
- **Agent:** TBD
- **Notes:** —

### GAP-4: Custom XML Data Parts
- **Status:** COMPLETE
- **Priority:** MEDIUM
- **Spec Reference:** ECMA-376 Part 1, §15.2.5 (Custom XML Data Storage)
- **Impact:** Presentations using add-ins, data-binding, or enterprise templates often store structured data in `customXml/` parts within the package. These are now parsed during load and preserved through save.
- **What was implemented:**
  - Added `PptxCustomXmlPart` type (`id`, `data`, `schemaUri?`, `properties?`)
  - Added `customXmlParts?: PptxCustomXmlPart[]` to `PptxData`
  - Load pipeline scans `customXml/item*.xml` entries and associated `itemProps*.xml`
  - Schema URI extracted from `ds:schemaRef` in item properties
  - Save pipeline writes all custom XML parts back to the ZIP package
  - Full round-trip preservation of custom XML data, properties, and schemas
- **Files modified:**
  - `packages/core/src/core/types/presentation.ts` — `PptxCustomXmlPart` type + `PptxData.customXmlParts`
  - `packages/core/src/core/core/runtime/PptxHandlerRuntimeState.ts` — runtime state field
  - `packages/core/src/core/core/runtime/PptxHandlerRuntimeLoadSession.ts` — `parseCustomXmlParts()` method
  - `packages/core/src/core/core/runtime/PptxHandlerRuntimeLoadPipeline.ts` — call parse + wire to builder
  - `packages/core/src/core/core/builders/PptxLoadDataBuilder.ts` — `withCustomXmlParts()` builder method
  - `packages/core/src/core/core/runtime/PptxHandlerRuntimeSaveDocumentParts.ts` — `applyCustomXmlPartsPreservation()` method
  - `packages/core/src/core/core/runtime/PptxHandlerRuntimeSavePipeline.ts` — call preservation in save
- **Agent:** gap4-customxml
- **Notes:** —

### GAP-5: Photo Album Metadata
- **Status:** COMPLETE
- **Priority:** LOW
- **Spec Reference:** ECMA-376 Part 1, §19.2.1.27 (photoAlbum)
- **Impact:** Presentations created via Insert > Photo Album in PowerPoint store `p:photoAlbum` metadata in `presentation.xml`. This metadata (frame type, layout, black-and-white flag) is now parsed, exposed, and round-tripped.
- **What was done:**
  - Added `PptxPhotoAlbum` type to `packages/core/src/core/types/presentation.ts`
  - Added `photoAlbum?: PptxPhotoAlbum` to `PptxData`
  - Parsing `p:photoAlbum` attributes (bw, showCaptions, layout, frame) in `PptxHandlerRuntimePresentationStructure.ts`
  - Builder support via `withPhotoAlbum()` in `PptxLoadDataBuilder`
  - Save support via `applyPhotoAlbum()` in `PptxPresentationSaveBuilder`
  - Wired into save pipeline via `PptxHandlerSaveOptions.photoAlbum`
- **Files affected:**
  - `packages/core/src/core/types/presentation.ts` — `PptxPhotoAlbum` interface, added to `PptxData`
  - `packages/core/src/core/core/runtime/PptxHandlerRuntimePresentationStructure.ts` — `extractPhotoAlbum()` method
  - `packages/core/src/core/core/runtime/PptxHandlerRuntimeLoadPipeline.ts` — wired into `buildLoadData()`
  - `packages/core/src/core/core/builders/PptxLoadDataBuilder.ts` — `withPhotoAlbum()` method
  - `packages/core/src/core/core/builders/PptxPresentationSaveBuilder.ts` — `applyPhotoAlbum()` method
  - `packages/core/src/core/core/runtime/PptxHandlerRuntimeSavePipeline.ts` — wired into save options
  - `packages/core/src/core/core/types.ts` — `photoAlbum` in `PptxHandlerSaveOptions`
- **Agent:** gap5-photoalbum
- **Notes:** —

### GAP-6: Write Protection / Modification Verifier
- **Status:** NOT STARTED
- **Priority:** MEDIUM
- **Spec Reference:** ECMA-376 Part 1, §19.2.1.22 (modifyVerifier)
- **Impact:** Presentations can be marked as "read-only recommended" or write-protected with a password hash via `p:modifyVerifier` in `presentation.xml`. This is not detected or enforced, and the element is lost on save.
- **What's needed:**
  - Parse `p:modifyVerifier` from `presentation.xml` (hashData, saltData, spinValue, algIdExt, cryptAlgorithmSid)
  - Store write-protection state in PptxData
  - Expose read-only recommendation flag to UI
  - Preserve modifyVerifier through round-trip save
  - Optionally verify password against hash
- **Files likely affected:**
  - `packages/core/src/core/types/presentation.ts`
  - `packages/core/src/core/core/runtime/PptxHandlerRuntimeLoadPipeline.ts`
  - `packages/core/src/core/core/runtime/PptxHandlerRuntimeSavePipeline.ts`
  - `packages/core/src/core/core/builders/PptxPresentationSaveBuilder.ts`
- **Agent:** TBD
- **Notes:** —

### GAP-7: Customer Data Tags (custDataLst)
- **Status:** NOT STARTED
- **Priority:** LOW
- **Spec Reference:** ECMA-376 Part 1, §19.2.1.3 (custDataLst), §19.3.1.6 (custData)
- **Impact:** Slides and presentations can contain `p:custDataLst` with references to custom data parts stored as relationships. These are used by some add-ins and enterprise integrations. Currently silently dropped.
- **What's needed:**
  - Parse `p:custDataLst` from presentation.xml and slide XML
  - Resolve custom data part relationships
  - Store raw custom data for round-trip preservation
  - Expose via API
- **Files likely affected:**
  - `packages/core/src/core/types/presentation.ts`
  - `packages/core/src/core/core/runtime/PptxHandlerRuntimeLoadPipeline.ts`
  - `packages/core/src/core/core/runtime/PptxHandlerRuntimeSlideParsing.ts`
  - `packages/core/src/core/core/runtime/PptxHandlerRuntimeSavePipeline.ts`
- **Agent:** TBD
- **Notes:** —

### GAP-8: External Linked Data Sources
- **Status:** NOT STARTED
- **Priority:** MEDIUM
- **Spec Reference:** ECMA-376 Part 1, §21.2 (Charts - externalData), §19.3.3 (OLE - linked)
- **Impact:** Charts can reference external Excel workbooks via `c:externalData` with a `r:id` pointing to an external relationship. Linked OLE objects reference external files. These external references are not parsed or preserved.
- **What's needed:**
  - Detect external relationships (TargetMode="External") in .rels files
  - Parse `c:externalData` in chart parts for external workbook references
  - Parse linked OLE object external references
  - Store external reference metadata (path, update mode)
  - Preserve external relationships through round-trip save
  - Mark elements with broken external links
- **Files likely affected:**
  - `packages/core/src/core/core/runtime/PptxHandlerRuntimeChartParsing.ts`
  - `packages/core/src/core/core/runtime/PptxHandlerRuntimeElementParsing.ts`
  - `packages/core/src/core/types/chart.ts`
  - `packages/core/src/core/types/elements.ts`
- **Agent:** TBD
- **Notes:** —

---

## Agent Assignment & Status Tracker

| Gap ID | Gap Name | Agent | Status | Last Updated |
|--------|----------|-------|--------|--------------|
| GAP-1 | VML Legacy Shape Support | — | NOT STARTED | 2026-03-07 |
| GAP-2 | Strict OOXML Conformance | — | NOT STARTED | 2026-03-07 |
| GAP-3 | mc:AlternateContent Fallback | — | NOT STARTED | 2026-03-07 |
| GAP-4 | Custom XML Data Parts | gap4-customxml | COMPLETE | 2026-03-07 |
| GAP-5 | Photo Album Metadata | gap5-photoalbum | COMPLETE | 2026-03-07 |
| GAP-6 | Write Protection | — | NOT STARTED | 2026-03-07 |
| GAP-7 | Customer Data Tags | — | NOT STARTED | 2026-03-07 |
| GAP-8 | External Linked Data | — | NOT STARTED | 2026-03-07 |

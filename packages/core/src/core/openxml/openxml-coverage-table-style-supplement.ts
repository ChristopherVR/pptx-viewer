/**
 * Overflow from `openxml-coverage-table-style-picture-fill.ts` (at the
 * 300-line file-size limit): table-style-level diagonal borders and the
 * table's own fill/effect properties, plus a couple of unrelated small
 * picture/geometry constructs closed in the 2026-09 ECMA-376 parity wave that
 * had nowhere else with headroom.
 */
import type { OpenXmlCoverageFacets } from './openxml-coverage';
import { testEvidence } from './openxml-coverage-evidence';

const overrides: Record<string, OpenXmlCoverageFacets> = {};

function assign(ids: readonly string[], facets: OpenXmlCoverageFacets): void {
	for (const id of ids) {
		overrides[id] = facets;
	}
}

assign(['drawing:element:tr2bl', 'drawing:element:tl2br'], {
	parse: 'native',
	preserve: 'unassessed',
	edit: 'unassessed',
	serialize: 'unassessed',
	note: "Table-style-level anti-diagonal border (a:tblStyleLst/.../a:tcStyle/a:tcBdr/a:tr2bl). Distinct from the per-cell a:lnTlToBr/a:lnBlToTr pair (openxml-coverage-table-style-picture-fill.ts): this construct sits inside a table STYLE definition, not a cell. Before issue G4 the parser read a never-real `a:bl2tr` key (this repo's own generated schema inventory lists only `tr2bl`), so every real-world `<a:tr2bl>` diagonal was silently dropped; it now reads the real element (and leniently still accepts a legacy `a:bl2tr` this app itself previously wrote). None of PowerPoint's 74 built-in gallery styles use a style-level diagonal, so this only affects a hand-authored or third-party tableStyles.xml. No editor authors a custom table style's diagonal border, so edit/serialize are left unassessed rather than assumed.",
	evidence: [
		testEvidence(
			'src/core/core/runtime/table-style-border-parse.test.ts',
			[
				'parses a real <a:tr2bl> node into the tr2bl field',
				'also accepts a legacy a:bl2tr node as a lenient alias for files this app previously wrote',
				'prefers a real a:tr2bl node over a stray legacy a:bl2tr sibling',
				'still parses tl2br (the other diagonal) alongside tr2bl',
			],
			['parse'],
		),
	],
});

assign(['drawing:complexType:CT_TableProperties'], {
	parse: 'native',
	preserve: 'native',
	edit: 'native',
	serialize: 'native',
	note: "a:tblPr carries the row/col emphasis flags and tableStyleId natively; since issue G6 its OWN fill (EG_FillProperties: solid/gradient/pattern/noFill, independent of a:tblStyleLst/a:tblBg) is also parsed onto the table root. Its own a:effectLst is now decomposed into a typed effect chain (table-style-effect-parse.ts parseTableEffectChain/writeTableEffectChain), not just a boolean flag. Since wave 3 (W3-E, issue G6's write side), a write-back path also exists (table-tblpr-save.ts writeTablePropertiesOwnFillAndEffects, wired into PptxHandlerRuntimeSaveDataSerialization.ts's serializeTableDataToXml): editing tableFill/tableEffects on the in-memory model now survives a save instead of being silently dropped, closing the caveat that a loaded table's own tblPr fill/effects were parsed but never re-emitted. An image (a:blipFill) fill and an opaque a:effectDag chain remain write-side no-ops (a relationship cannot be synthesised without archive access; the DAG was never decomposed on parse), and preserve-on-absent means an untouched table survives unmodified either way.",
	evidence: [
		testEvidence(
			'src/core/core/builders/table-data-parser.test.ts',
			[
				'parses an explicit sRGB a:solidFill directly on a:tblPr',
				'parses a theme scheme colour a:solidFill directly on a:tblPr',
				'flags tableEffects when a:tblPr carries its own a:effectLst',
				'leaves tableFill/tableEffects undefined when a:tblPr has neither',
				'does not confuse a:tblPr fill with a:tblStyleLst/wholeTbl fill',
			],
			['parse'],
		),
		testEvidence(
			'src/core/core/runtime/table-tblpr-save.test.ts',
			[
				're-parses the edited own fill',
				're-parses the edited own effect chain',
				'keeps reproducing the same fill/effects on a further save with no explicit edit',
			],
			['preserve', 'edit', 'serialize'],
		),
	],
});

assign(['drawing:attribute:preferRelativeResize'], {
	parse: 'native',
	preserve: 'unassessed',
	edit: 'unassessed',
	serialize: 'unassessed',
	note: 'a:cNvPicPr/@preferRelativeResize (ST_Boolean, spec default true, issue G13) now parses onto the picture element (surfaced as undefined, not true, when absent, so "not authored" stays distinguishable from "explicitly true"). Nothing yet reinterprets crop-then-resize arithmetic against it, so it is round-tripped as inert metadata; edit/serialize are left unassessed since no writer independently re-emits it from the typed field.',
	evidence: [
		testEvidence(
			'src/core/core/runtime/picture-non-visual-parse.test.ts',
			[
				'returns undefined when the attribute is absent (spec default is true)',
				'returns true for an explicit "1"',
				'returns false for "0"',
				'is case-insensitive and trims whitespace',
			],
			['parse'],
		),
	],
});

assign(['drawing:element:ahXY', 'drawing:element:ahPolar'], {
	parse: 'passthrough',
	preserve: 'native',
	edit: 'partial',
	serialize: 'passthrough',
	note: "A custGeom's XY and polar adjustment handles are preserved verbatim as raw XML on an untouched round-trip (not decomposed into an independently-parsed typed field). Since issue D3-G3, dragging a shared-render-derived handle now writes back into the a:gdLst guide it references (applyCustomGeometryGuideOverrides, wired from the custGeom save branch), the freeform counterpart to how a preset shape's own adjustment values are rebuilt from shapeAdjustments; that guide-level edit is what is graded partial here; a:ahXY/a:ahPolar's own XML is not independently rewritten from a typed handle model, hence serialize stays passthrough. Since wave 2 (W2-G), the shape's rendered path body also re-evaluates and reshapes live while the handle is still being dragged (core geometry/custom-geometry-live-eval.ts evaluating the preserved a:pathLst against the in-progress override, shared custom-geometry-live-path.ts and subpath-fill-overlay.ts consuming it), matching how a preset shape's own handles already reshape live; that used to be a documented limitations-list gap and no longer is. This live-render behaviour has no facet of its own in this manifest, which continues to grade only how ahXY/ahPolar's own XML round-trips.",
	evidence: [
		testEvidence(
			'src/core/geometry/custom-geometry.test.ts',
			['preserves raw adjustment, guide, handle, connection, and text-rect data'],
			['parse', 'preserve', 'serialize'],
		),
		testEvidence(
			'src/core/geometry/custom-geometry-guide-writeback.test.ts',
			[
				'returns the input unchanged when there are no overrides',
				'patches an existing a:gd/@_fmla to the dragged value',
				'preserves every OTHER a:gd entry when patching one of several',
				'adds a new a:gd entry for an override naming a guide not already in a:avLst',
			],
			['edit'],
		),
	],
});

export const OPENXML_TABLE_STYLE_SUPPLEMENT_COVERAGE: Readonly<
	Record<string, OpenXmlCoverageFacets>
> = overrides;

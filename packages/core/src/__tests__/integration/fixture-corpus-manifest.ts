/**
 * The registry of every binary presentation fixture in this repository.
 *
 * ## Why this exists
 *
 * Eight defects that made PowerPoint refuse to open a saved deck shipped under
 * a green suite, across 82 e2e specs and three CI shards, because **nothing
 * ever opened a saved file**. Of 58 files named `*roundtrip*` in
 * `src/__tests__/integration/`, exactly one fed genuine PowerPoint output
 * through a full load -> save -> reload cycle; the rest hand-built the XML they
 * then asserted on, so they only proved the code round-trips its own
 * assumptions.
 *
 * `fixture-corpus-roundtrip.test.ts` closes that hole by running every deck
 * listed here through a real cycle. This file is the part a human maintains:
 * where each deck came from, whether it is trustworthy as ground truth, and
 * which deviations from a perfect round trip are accepted rather than
 * accidental.
 *
 * ## The presence guard
 *
 * The harness asserts that the manifest and the directory listings agree
 * EXACTLY, in both directions. A fixture that is deleted, renamed or moved
 * fails the suite loudly instead of quietly reducing coverage, and a fixture
 * added without a manifest entry fails too, so new decks cannot slip in
 * unclassified. This replaces the `it.skipIf(!existsSync(fixture))` pattern,
 * which passes green when its fixture is gone.
 *
 * ## Choosing a deck to reproduce a defect with
 *
 * Prefer a SMALL GENUINE deck. Size is not fidelity: a media-slimmed 726 KB
 * deck reproduced more defects than an 8 MB one, because what matters is the
 * variety of markup, not the weight of the media. Provenance is not optional
 * either - a `synthetic` deck is our own serializer's output fed back to our
 * own parser, so it cannot witness a disagreement between us and PowerPoint.
 * Use `genuineFixtures()` when you need ground truth.
 *
 * @module __tests__/integration/fixture-corpus-manifest
 */
import { readdirSync } from 'node:fs';
import path from 'node:path';

/** Where a fixture lives. */
export type FixtureDir = 'e2e' | 'corpus';

/**
 * Who authored the bytes on disk.
 *
 * - `powerpoint`: genuine Microsoft PowerPoint output. The only decks that can
 *   settle a disagreement about what PowerPoint accepts.
 * - `third-party`: genuine output of some other real authoring tool (WPS
 *   Presentation, or a real-world deck whose `docProps` were stripped before
 *   it was committed). Still useful ground truth for parsing, because none of
 *   it came from us, but it is not proof of what PowerPoint emits.
 * - `synthetic`: built by our own SDK or by one of the `e2e/fixtures/
 *   generate-*.ts` scripts, and stamped `<Application>pptx-viewer-sdk</...>`
 *   or carrying no `docProps` at all. Useful for pinning a specific markup
 *   shape; worthless as evidence about PowerPoint.
 */
export type FixtureProvenance = 'powerpoint' | 'third-party' | 'synthetic';

/** How the harness should treat the fixture. */
export type FixtureStatus =
	/** Full load -> save -> reload -> validate coverage. */
	| 'roundtrip'
	/** Not a readable ZIP by design; the harness asserts it stays that way. */
	| 'encrypted'
	/**
	 * A legacy binary `.ppt` (PowerPoint 97-2003). It is not an OpenXML package
	 * at all, so the load -> save -> reload harness cannot compare its parts
	 * against itself: it loads as a `.ppt` and saves as a `.pptx`, by design (we
	 * read the binary format and never write it). Coverage lives in
	 * `ppt-import.test.ts`, which compares the imported model against the
	 * `.pptx` the fixture was exported from, and in `e2e/ppt-import-parity.spec.ts`.
	 * Declared here so the presence guard still catches a deleted or renamed one.
	 */
	| 'legacy-ppt';

export interface FixtureEntry {
	readonly file: string;
	readonly dir: FixtureDir;
	readonly provenance: FixtureProvenance;
	readonly status: FixtureStatus;
	/** One line on what the deck is for, and where it came from. */
	readonly note: string;
	/**
	 * Parts the save pipeline is ALLOWED to drop for this deck, with the
	 * reason. Anything else disappearing is a failure.
	 */
	readonly allowedPartLoss?: readonly string[];
	/**
	 * A round-trip invariant this deck is currently KNOWN to violate, keyed by
	 * the harness check name. The harness asserts the violation is still there,
	 * so the entry cannot rot: fixing the defect turns the test red and tells
	 * you to delete the entry. Never add one without a written cause.
	 */
	readonly knownDefects?: Readonly<Record<string, string>>;
	/**
	 * Set when PowerPoint refuses to open the deck AS COMMITTED, before our
	 * save pipeline has touched it, with the reason. The deck is then useless
	 * as ground truth for anything about PowerPoint, and
	 * `scripts/com-acceptance.mjs` reports it separately so a broken fixture is
	 * never mistaken for a save regression. A fixture with this field is a
	 * standing debt, not an accepted state.
	 */
	readonly powerpointRejects?: string;
}

/**
 * `e2e/fixtures/*.pptx`. These double as the demo apps' public dir, so the e2e
 * specs load them by name.
 */
const E2E_FIXTURES: readonly FixtureEntry[] = [
	{
		file: '36_Slides_Extra_Large_22_5_MB_578ce6bbf3.pptx',
		dir: 'e2e',
		provenance: 'third-party',
		status: 'roundtrip',
		note: 'Real-world corpus download, 36 slides / 26 media parts. Stress case for part count and archive size.',
	},
	{
		file: 'Image_JPG_PNG_Audio_M4_A_Video_MP_4_12_Slides_36_8_MB_ff1095731b.pptx',
		dir: 'e2e',
		provenance: 'third-party',
		status: 'roundtrip',
		note: 'Real-world corpus download; the mixed-media deck (jpg, png, m4a, mp4). Largest fixture in the repo.',
		allowedPartLoss: [
			// The deck carries `<p:cmAuthorLst/>` with no authors and no comment
			// parts anywhere. The save drops the part, its content-type override
			// and its presentation relationship together, leaving nothing
			// dangling, so this is a consistent cleanup rather than data loss.
			'ppt/commentAuthors.xml',
		],
	},
	{
		file: 'Japanese_10_Slides_1_8_MB_bbd4090b55.pptx',
		dir: 'e2e',
		provenance: 'third-party',
		status: 'roundtrip',
		note: 'Real-world corpus download; CJK text, east-asian font runs and speaker notes.',
	},
	{
		file: 'Mathematical_Equations_11_Slides_46_KB_3c22e70f4d.pptx',
		dir: 'e2e',
		provenance: 'third-party',
		status: 'roundtrip',
		note: 'Real-world corpus download; OMML equations. 45 KB and media-free, so it is the cheapest genuine deck here.',
		allowedPartLoss: ['ppt/commentAuthors.xml'],
	},
	{
		file: 'Non_Latin_Arabic_RTL_text_11_Slides_7_3_MB_7f135c4f96.pptx',
		dir: 'e2e',
		provenance: 'third-party',
		status: 'roundtrip',
		note: 'Real-world corpus download; Arabic RTL paragraphs and bidi runs.',
	},
	{
		file: 'Password_Protected_123_8_Slides_2_3_MB_927e34cd0c.pptx',
		dir: 'e2e',
		provenance: 'third-party',
		status: 'encrypted',
		note: 'Real-world corpus download, password "123". An OLE compound file, not a ZIP; the loader must reject it cleanly rather than crash.',
	},
	{
		file: 'Simplified_Chinese_10_Slides_1_8_MB_792c2c1166.pptx',
		dir: 'e2e',
		provenance: 'third-party',
		status: 'roundtrip',
		note: 'Real-world corpus download; Simplified Chinese text and notes.',
	},
	{
		file: 'Slide_Animations_Speaker_comments_8_Slides_2_7_MB_c8f64d1a03.pptx',
		dir: 'e2e',
		provenance: 'third-party',
		status: 'roundtrip',
		note: 'Real-world corpus download; p:timing animation trees plus speaker notes.',
	},
	{
		file: 'absolute-path-rels.pptx',
		dir: 'e2e',
		provenance: 'third-party',
		status: 'roundtrip',
		note:
			'Real-world deck whose relationship targets are absolute (/ppt/...) rather than relative. ' +
			'Drives absolute-path-rels.spec.ts. The ONLY deck in the corpus whose slide LAYOUTS contain ' +
			'a p:grpSp, which is why the layout-migration defect it once witnessed went unnoticed for so ' +
			'long: saving copied the layout groups to the front of every slide spTree and flattened the ' +
			'layout itself (PowerPoint counted 82 shapes going in and 106 coming out). Fixed; the rule is ' +
			'now held for the whole corpus by the layout-migration invariant in save-invariants.test.ts, ' +
			'so keep this deck: it is the only witness that invariant has.',
	},
	{
		file: 'anatidae-animation.pptx',
		dir: 'e2e',
		provenance: 'powerpoint',
		status: 'roundtrip',
		note: 'Genuine PowerPoint deck (third-party author) used for animation and morph work.',
	},
	{
		file: 'animation-builds-color.pptx',
		dir: 'e2e',
		provenance: 'powerpoint',
		status: 'roundtrip',
		note: 'Genuine PowerPoint deck, 55 KB, authored for paragraph-build and colour-change animations. Small and genuine: a good first deck to reproduce with.',
	},
	{
		file: 'canvas-interaction.pptx',
		dir: 'e2e',
		provenance: 'synthetic',
		status: 'roundtrip',
		note: 'Generated by generate-canvas-interaction-fixture.ts for drag/resize/selection specs.',
	},
	{
		file: 'chart-data-fidelity.pptx',
		dir: 'e2e',
		provenance: 'powerpoint',
		status: 'roundtrip',
		note: 'COM-authored ground truth for chart series data: slide 1 a bubble chart whose three series each carry their own c:xVal / c:yVal / c:bubbleSize, slide 2 a scatter written as scatterStyle="lineMarker" with c:symbol val="none" on every series (lines only, no markers), slide 3 a column chart with a BLANK middle category so c:strCache is sparse (ptCount 5, idx 2 missing) while c:numCache is dense, slide 4 a pie whose SERIES-level c:dLbls sets showPercent + showCatName + separator while the chart-level c:dLbls is all zeros. Authored because chart-gallery.pptx is synthetic and PowerPoint refuses it.',
	},
	{
		file: 'chart-gallery.pptx',
		dir: 'e2e',
		provenance: 'synthetic',
		status: 'roundtrip',
		note: 'Generated by generate-chart-fixture.ts: one chart per slide across 14 chart kinds, four of them chartex. Drives chart-rendering.spec.ts in all five bindings.',
		// Two separate faults, one fixed and one outstanding.
		//
		// FIXED: the four chartex parts (funnel, sunburst, histogram,
		// box-whisker) were declared as classic `drawingml.chart+xml`, bound
		// with the classic relationship type, and referenced through a
		// `<c:chart>` in a classic `graphicData/@uri`, while their root element
		// was `cx:chartSpace`. PowerPoint validated them against the `c:`
		// schema and refused the package. The generator now emits the chartex
		// content type, relationship type, uri and `<cx:chart>` element for
		// exactly those four.
		//
		// OUTSTANDING: the chartex PAYLOAD itself is hand-written and not valid
		// MS-CHARTEX. Proof by construction: deleting the four chartex parts
		// and their frames from the committed fixture makes PowerPoint open it
		// cleanly (14 slides, 24 shapes), and no other change is needed.
		// Adding the `a:bodyPr` that `CT_TextBody` requires inside `cx:rich`,
		// dropping the title, and correcting `layoutId="histogram"` (not an
		// `ST_SeriesLayout` token; a real histogram is `clusteredColumn` plus a
		// `cx:binning` layoutPr) were each tried and none is sufficient.
		// Authoring correct chartex is a real job; until it is done, treat the
		// four chartex slides as covering OUR renderer only, never PowerPoint.
		powerpointRejects:
			'The four hand-authored cx:chartSpace payloads (slides 11-14) are not valid MS-CHARTEX; removing them makes the deck open.',
	},
	{
		file: 'comment-mentions.pptx',
		dir: 'e2e',
		provenance: 'powerpoint',
		status: 'roundtrip',
		note:
			'The corpus witness for a MODERN (p188) threaded comment carrying an @-mention. PowerPoint ' +
			'authored the comment through COM, so ppt/authors.xml, the ppt/comments/modernComment_*.xml ' +
			'part name, the pc:sldMkLst anchor and the whole envelope are its own output. Only two things ' +
			'were injected afterwards: a second p188:author (Bob Grant) and the p188:mentionLst span that ' +
			'points at him, because a mention cannot be authored through COM at all - it needs a real ' +
			'M365/AAD identity. PowerPoint reopens the result cleanly. Before this deck existed there was ' +
			'no p188 fixture anywhere in the repo, which is why mention offset re-basing was scoped out ' +
			'of the earlier comment wave.',
	},
	{
		file: 'connector-arrows.pptx',
		dir: 'e2e',
		provenance: 'synthetic',
		status: 'roundtrip',
		note: 'Generated by generate-connector-arrows-fixture.ts; connector head/tail arrow parity.',
	},
	{
		file: 'descender-clip.pptx',
		dir: 'e2e',
		provenance: 'synthetic',
		status: 'roundtrip',
		note:
			'Hand-built minimal deck for the glyph-descender clipping regression. One slide, one text ' +
			'box, and an <a:overrideClrMapping>: the smallest reproduction of the folHlink case-folding ' +
			'P0, where saving lowercased the ST_ColorSchemeIndex token and PowerPoint refused the file ' +
			'with 0x80070570. Fixed; held for the whole corpus by the case-folding invariant in ' +
			'save-invariants.test.ts.',
	},
	{
		file: 'field-substitution.pptx',
		dir: 'e2e',
		provenance: 'synthetic',
		status: 'roundtrip',
		note: 'Generated by generate-field-substitution-fixture.ts; slide-number, date and footer fields.',
	},
	{
		file: 'format-painter.pptx',
		dir: 'e2e',
		provenance: 'synthetic',
		status: 'roundtrip',
		note: 'Generated by generate-format-painter-fixture.ts.',
	},
	{
		file: 'header-footer-shows.pptx',
		dir: 'e2e',
		provenance: 'powerpoint',
		status: 'roundtrip',
		note:
			'Authored by PowerPoint through COM for the header/footer + custom-show work. Three ' +
			'slides; the slide master carries <p:hf hdr="0"/> plus "Fixture Footer" and "Fixture ' +
			'Date" in its ftr / dt placeholders (which is where PowerPoint keeps the Header & Footer ' +
			'dialog TEXT: p:hf is NOT a child of p:presentation, and no real deck has ever had one ' +
			'there). It also defines two custom shows, "Short Show" (slides 1, 3) and "Reverse" ' +
			'(3, 2, 1), whose p:sldLst entries are relationship ids, and a p:showPr/p:custShow id="0" ' +
			'selecting the first, so it is the only fixture that can witness a deck authored to open ' +
			'into a custom show.',
	},
	{
		file: 'ink-annotation.pptx',
		dir: 'e2e',
		provenance: 'synthetic',
		status: 'roundtrip',
		note: 'Generated by generate-ole-ink-fixtures.ts. Despite the name it does NOT use p:contentPart; see below.',
		// PowerPoint refuses this deck as committed with 0x80070570. Isolated
		// by deletion: removing the single `p:graphicFrame` from slide 1 makes
		// it open, and nothing else in the package matters.
		//
		// The frame nests an `mc:AlternateContent` INSIDE `a:graphicData`,
		// whose `mc:Choice` holds invented `aink:ink` / `aink:inkBrush` /
		// `aink:trace` markup and whose `mc:Fallback` holds a PresentationML
		// `<p:sp>` inside a DrawingML graphic. None of that is real ink. Real
		// ink is either a `<p:contentPart r:id>` pointing at an InkML part, or
		// an `mc:AlternateContent` wrapping the WHOLE `p:graphicFrame` at
		// spTree level, never inside `a:graphicData`.
		//
		// Not repaired here because four e2e specs and the core ink tests parse
		// this exact markup, so changing it is a coordinated change rather than
		// a fixture fix. `contentpart-ink-authoring.test.ts` and
		// `contentpart-save-roundtrip.test.ts` do cover the real
		// `p:contentPart` shape.
		powerpointRejects:
			'The p:graphicFrame nests mc:AlternateContent inside a:graphicData with invented aink: markup and a p:sp fallback; removing the frame makes the deck open.',
	},
	{
		file: 'ink-contentpart.pptx',
		dir: 'e2e',
		provenance: 'powerpoint',
		status: 'roundtrip',
		note:
			'The corpus witness for REAL PowerPoint ink, and the deck that proved the p14 capability gap. ' +
			'Two slides, each with a p:contentPart bound to an InkML part through the customXml ' +
			'relationship type: slide 1 carries a red 0.05 cm sine plus three blue 0.1 cm strokes, slide 2 ' +
			'a red underline and arrow head. Authored by injecting the markup into a PowerPoint-created ' +
			'deck and then SAVING IT AGAIN FROM POWERPOINT, so every byte committed here is PowerPoint ' +
			'serialization: the mc:Choice Requires="p14" envelope with p14:nvContentPartPr / p14:xfrm ' +
			'children, and crucially the COMPACT DIFFERENCE-ENCODED trace text ("100 200,\'40\'46,\\"0\\"-5,0-10") ' +
			'that no hand-written fixture would ever have produced. PowerPoint reports both content parts ' +
			'as msoInk (Shape.Type 23) at the exact p14:xfrm box, and reopens our re-saved copy the same ' +
			'way. Note the SlideShowView.DrawLine route to authoring ink crashes PowerPoint on this ' +
			'machine (0x800706BE on Exit), which is why the fixture is built this way. Prefer this deck ' +
			'over ink-annotation.pptx, whose aink markup is invented and which PowerPoint refuses outright.',
	},
	{
		file: 'issue-132-gradient-fill.pptx',
		dir: 'e2e',
		provenance: 'third-party',
		status: 'roundtrip',
		note: 'WPS Presentation output, 709 KB. The media-slimmed deck from issue 132 that reproduced more gradient and clip-path defects than the 8 MB deck it was cut from.',
	},
	{
		file: 'issue-132-hr-deck.pptx',
		dir: 'e2e',
		provenance: 'third-party',
		status: 'roundtrip',
		note: 'WPS Presentation output, 8 MB, 26 slides. Interleaves p:pic / p:cxnSp / p:graphicFrame with p:sp, so it witnesses spTree z-order.',
	},
	{
		file: 'line-fill-fidelity.pptx',
		dir: 'e2e',
		provenance: 'synthetic',
		status: 'roundtrip',
		note: 'Generated by generate-line-fill-fidelity-fixture.ts.',
	},
	{
		file: 'linked-textbox.pptx',
		dir: 'e2e',
		provenance: 'synthetic',
		status: 'roundtrip',
		note: 'Generated by generate-linked-textbox-fixture.ts.',
	},
	{
		file: 'master-views.pptx',
		dir: 'e2e',
		provenance: 'synthetic',
		status: 'roundtrip',
		note:
			'Generated by generate-master-views-fixture.ts. WEAK FIXTURE, do not build master or layout ' +
			'assertions on it: it comes from createBlank, whose slideMaster1 and every slideLayout have ' +
			'an EMPTY spTree (0 p:sp, 0 p:pic, one p:cNvPr for the tree root itself). It therefore ' +
			'cannot witness any master- or layout-content defect, and an assertion written against it ' +
			'will pass no matter what the save pipeline does to template shapes. Use ' +
			'template-editing.pptx (real shapes on both) or solution-explorer.pptx / ' +
			'absolute-path-rels.pptx (genuine decks with populated layouts) instead. The e2e ' +
			'master-views spec has already been moved off it for this reason.',
	},
	{
		file: 'morph-shape-swap.pptx',
		dir: 'e2e',
		provenance: 'synthetic',
		status: 'roundtrip',
		note: 'Generated by generate-morph-shape-swap-fixture.ts; the morph-transition pairing corpus.',
	},
	{
		file: 'ole-embed.pptx',
		dir: 'e2e',
		provenance: 'synthetic',
		status: 'roundtrip',
		note: 'Generated by generate-ole-ink-fixtures.ts; an embedded OLE object with a preview image.',
	},
	{
		file: 'pattern-outline.pptx',
		dir: 'e2e',
		provenance: 'synthetic',
		status: 'roundtrip',
		note: 'Generated by generate-pattern-outline-fixture.ts; a:pattFill and compound outlines.',
	},
	{
		file: 'sample-deck.ppt',
		dir: 'e2e',
		provenance: 'powerpoint',
		status: 'legacy-ppt',
		note: 'PowerPoint COM SaveAs(ppSaveAsPresentation97) of sample-deck.pptx on this machine, so the two are the same deck in two formats and the .ppt import can be diffed against its own twin. Drives e2e/ppt-import-parity.spec.ts.',
	},
	{
		file: 'sample-deck.pptx',
		dir: 'e2e',
		provenance: 'synthetic',
		status: 'roundtrip',
		note: 'Built by scripts/make-sample-deck.mjs; the default deck the demos open.',
	},
	{
		file: 'shape-3d-compound.pptx',
		dir: 'e2e',
		provenance: 'synthetic',
		status: 'roundtrip',
		note:
			'Built by scripts/make-shape-3d-fixture.mjs; a:sp3d / a:scene3d and compound lines. Also ' +
			'carries an <a:overrideClrMapping>, so it was the second witness of the folHlink ' +
			'case-folding P0 (now fixed).',
	},
	{
		file: 'solution-explorer.pptx',
		dir: 'e2e',
		provenance: 'powerpoint',
		status: 'roundtrip',
		note: 'Genuine PowerPoint deck, 332 parts. Carries the idx="4294967295" orphaned placeholder, p:sld-level mc:AlternateContent transitions and empty-r:id action hyperlinks. The single richest defect witness in the repo.',
	},
	{
		file: 'table-styling.pptx',
		dir: 'e2e',
		provenance: 'powerpoint',
		status: 'roundtrip',
		note: 'COM-authored, 40 KB, one table per slide for table style / banding / rtl / per-run cell formatting work (wave-3 parity round). PowerPoint output with ONE scripted edit: slide 5 references built-in style {93296810-...} "Medium Style 2 - Accent 6" and that single <a:tblStyle> was deleted from ppt/tableStyles.xml afterwards, reproducing what a non-PowerPoint producer emits (the gallery styles are known by GUID and never written into the package). PowerPoint reopens the deck, and the re-saved deck, without repair.',
	},
	{
		file: 'template-editing.pptx',
		dir: 'e2e',
		provenance: 'synthetic',
		status: 'roundtrip',
		note: 'Generated by generate-template-editing-fixture.ts; editTemplateMode coverage.',
	},
	{
		file: 'template-group.pptx',
		dir: 'e2e',
		provenance: 'synthetic',
		status: 'roundtrip',
		note:
			'Generated by generate-template-group-fixture.ts. The corpus witness for group-inclusive ' +
			'ordering in a TEMPLATE: its slideLayout1 holds a p:grpSp whose children interleave p:sp ' +
			'and p:cxnSp. Before it existed all 22 template groups in the corpus were homogeneous, so ' +
			'a deep ordering check passed whether the pipeline was fixed or broken, and the agent who ' +
			'fixed template ordering had to prove the recursion by deleting it and watching a ' +
			'hand-written test fail. Asserted outright, with no ledger entry - keep it that way, and ' +
			'keep the interleaving if you regenerate. Verified to open in PowerPoint.',
	},
	{
		file: 'template-mce.pptx',
		dir: 'e2e',
		provenance: 'synthetic',
		status: 'roundtrip',
		note:
			'Generated by generate-template-group-fixture.ts. The corpus witness for an ' +
			'mc:AlternateContent envelope inside a TEMPLATE shape tree: its slideLayout1 holds a ' +
			'depth-0 envelope with both a Choice and a Fallback. Measured before it existed: ZERO such ' +
			'envelopes in any of the 524 template parts across all 38 decks. Beware the near misses, ' +
			'which look like coverage and are not - the 87 envelopes in solution-explorer and friends ' +
			'are p:sld-level TRANSITION envelopes on a different code path, and the only 3 inside any ' +
			'shape tree sit deep in a p:graphicFrame/a:graphicData. Deliberately a SEPARATE deck from ' +
			'template-group.pptx, because the ledger below is keyed per fixture and would otherwise ' +
			'excuse the group check too. Verified to open in PowerPoint.',
		knownDefects: {
			// Witnessed for the first time by this fixture. It was previously
			// carried as a prose note in the manifest because nothing in the corpus
			// could reproduce it, which is a strictly worse record: nothing asserts
			// prose, and nothing tells you the day it is fixed.
			//
			// `unwrapAlternateContent` mutates the CACHED layout/master spTree in
			// place, deleting the mc:AlternateContent envelope and appending the
			// selected branch's children to the parent. That cache is what the
			// passthrough flush later writes, so the envelope never reaches the
			// saved layout and the Fallback branch goes with it. Measured on this
			// deck: mc:AlternateContent 1 -> 0, LayoutMceFallbackShape disappears,
			// LayoutMceChoiceShape survives as a bare child.
			//
			// The damage is silent. The deck still opens and still renders, so only
			// a consumer that needed the Fallback - or a future PowerPoint that
			// would have selected a different Choice - ever notices.
			templateShapeIdentityStable:
				'unwrapAlternateContent drops the mc:Fallback branch from the layout, so LayoutMceFallbackShape is lost on save.',
			templateSpTreeOrderStable:
				'unwrapAlternateContent replaces the layout mc:AlternateContent envelope with its Choice children, changing the depth-0 child sequence.',
			templateSpTreeDeepOrderStable:
				'The same envelope removal changes the group-inclusive child sequence of the layout shape tree.',
		},
	},
	{
		file: 'text-features.ppt',
		dir: 'e2e',
		provenance: 'powerpoint',
		status: 'legacy-ppt',
		note: 'PowerPoint COM SaveAs(ppSaveAsPresentation97) of text-features.pptx on this machine; the typography edge cases as the binary format stores them. Drives e2e/ppt-import-parity.spec.ts.',
	},
	{
		file: 'text-features.pptx',
		dir: 'e2e',
		provenance: 'synthetic',
		status: 'roundtrip',
		note: 'Built by scripts/make-text-features-fixture.mjs; the run-growth idempotency witness.',
	},
	{
		file: 'text-body.pptx',
		dir: 'e2e',
		provenance: 'synthetic',
		status: 'roundtrip',
		note: 'Generated by generate-text-body-fixture.ts; the a:bodyPr body features (numCol/spcCol, tabLst/defTabSz, anchorCtr, vertOverflow, rot) plus a chevron whose a:rect text rectangle insets its label. Opens in PowerPoint (COM verified).',
	},
	{
		file: 'text-layout.pptx',
		dir: 'e2e',
		provenance: 'synthetic',
		status: 'roundtrip',
		note: 'Generated by generate-text-layout-fixture.ts; wrapping, insets and autofit.',
	},
	{
		file: 'transitions-animations.pptx',
		dir: 'e2e',
		provenance: 'synthetic',
		status: 'roundtrip',
		note: 'Generated by generate-transitions-animations-fixture.ts.',
	},
];

/**
 * `src/__tests__/fixtures/corpus/*.pptx`: the five decks authored by driving
 * PowerPoint itself through COM. See that directory's README. These are the
 * highest-confidence ground truth in the repo and are additionally covered in
 * depth by `real-world-corpus-roundtrip.test.ts`.
 */
const CORPUS_FIXTURES: readonly FixtureEntry[] = [
	{
		file: 'animations-transitions-multislide.pptx',
		dir: 'corpus',
		provenance: 'powerpoint',
		status: 'roundtrip',
		note: 'COM-authored: p:timing trees and per-slide transitions across several slides.',
	},
	{
		file: 'master-layout-inheritance-fills.pptx',
		dir: 'corpus',
		provenance: 'powerpoint',
		status: 'roundtrip',
		note: 'COM-authored: placeholder inheritance through layout and master, plus theme fills.',
	},
	{
		file: 'ole-embedded-media.pptx',
		dir: 'corpus',
		provenance: 'powerpoint',
		status: 'roundtrip',
		note: 'COM-authored: embedded OLE objects and media, with empty-r:id action hyperlinks.',
	},
	{
		file: 'preset-geometry-wordart.pptx',
		dir: 'corpus',
		provenance: 'powerpoint',
		status: 'roundtrip',
		note: 'COM-authored: preset geometries with adjustments, and WordArt text effects.',
	},
	{
		file: 'smartart-chart-table-mix.pptx',
		dir: 'corpus',
		provenance: 'powerpoint',
		status: 'roundtrip',
		note: 'COM-authored: SmartArt diagrams, a chart and a table on one deck.',
	},
];

export const FIXTURE_MANIFEST: readonly FixtureEntry[] = [...E2E_FIXTURES, ...CORPUS_FIXTURES];

const REPO_ROOT = path.resolve(__dirname, '../../../../..');

export const FIXTURE_DIRS: Readonly<Record<FixtureDir, string>> = {
	e2e: path.join(REPO_ROOT, 'e2e', 'fixtures'),
	corpus: path.resolve(__dirname, '../fixtures/corpus'),
};

/** Absolute path of a manifest entry. */
export function fixturePath(entry: FixtureEntry): string {
	return path.join(FIXTURE_DIRS[entry.dir], entry.file);
}

/**
 * Every presentation binary actually present in `dir`, sorted, whatever the
 * manifest says. Legacy binary `.ppt` counts: the loader really opens it (see
 * `core/ppt/`), so a `.ppt` fixture is real coverage and must not be able to
 * vanish unnoticed any more than a `.pptx` can.
 */
export function listFixturesOnDisk(dir: FixtureDir): string[] {
	return readdirSync(FIXTURE_DIRS[dir])
		.filter((f) => /\.pptx?$/iu.test(f))
		.sort();
}

/**
 * Manifest entries for `dir`, sorted the same way {@link listFixturesOnDisk}
 * sorts, so the two can be compared directly. Plain code-unit order, NOT
 * `localeCompare`: the latter folds case and would disagree with `readdirSync`
 * on the capitalised real-world downloads.
 */
export function manifestFor(dir: FixtureDir): FixtureEntry[] {
	return FIXTURE_MANIFEST.filter((e) => e.dir === dir).sort((a, b) => (a.file < b.file ? -1 : 1));
}

/**
 * The decks no part of this project authored. Reach for these when you need to
 * know what a real tool emits rather than what our serializer emits.
 */
export function genuineFixtures(): FixtureEntry[] {
	return FIXTURE_MANIFEST.filter((e) => e.provenance !== 'synthetic');
}

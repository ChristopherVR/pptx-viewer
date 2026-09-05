/**
 * Generates `smartart-build-reveal.pptx` - a single-slide deck carrying a
 * SmartArt diagram whose entrance builds ONE NODE AT A TIME, authored with
 * explicit per-node `p:spTgt/p:graphicEl/p:dgm` targets in REVERSE node-list
 * order, for `e2e/smartart-build-reveal.spec.ts`.
 *
 * Why this generator post-processes the package zip instead of using the
 * SDK's `addAnimation`: that simplified model authors only a single
 * whole-element entrance per shape (see `generate-transitions-animations-
 * fixture.ts`), with no way to express PowerPoint's richer per-stage
 * `p:bldDgm` build (one discrete click-group per node, each carrying the
 * exact data-model point id it reveals). Real PowerPoint (via COM AddEffect
 * automation) also only produces the coarse single-entrance + `p:bldGraphic`
 * declaration for the DEFAULT build direction (see
 * `e2e/fixtures/animation-builds-color.pptx` slide 2, and the module doc in
 * `packages/shared/src/render/diagram-reveal-descriptor.ts`), which the
 * count-based `revealedSmartArtNodeCount` path already covers; a fixture
 * proving the AUTHORED-INDEX path (`diagram-reveal-descriptor`'s
 * `resolveDiagramRevealDescriptor`) needs the explicit-index shape ECMA-376
 * allows for a reversed/gapped build, which requires hand-authoring the
 * timing tree:
 *
 *   1. Build a valid base deck via `PptxHandler.createBlank` - one slide with
 *      a title textbox and a SmartArt element (3 nodes, no `p:timing` yet).
 *      The SmartArt element's `shapeId` is pinned explicitly so the timing
 *      tree can target it (`p:spTgt/@spid`) without having to re-parse the
 *      saved XML to discover an auto-minted id.
 *   2. Re-open the saved package with JSZip and remap every fabricated
 *      `newSmartArtGuid()` id (data-model points, connections, transitions)
 *      to a fixed, index-based placeholder, in stable first-appearance order.
 *      `newSmartArtGuid()` is not seeded, so without this step the fixture
 *      bytes (and which node each hand-authored `p:graphicEl` below targets)
 *      would differ on every regeneration.
 *   3. RELOAD the now-deterministic bytes to discover the REAL (now fixed)
 *      data-model point ids (`PptxSmartArtNode.id` - the in-memory node ids
 *      given at step 1 do not survive fabrication).
 *   4. Inject a hand-authored
 *      `p:timing` tree: three sibling `p:par` click-groups (mirroring the
 *      exact `tmRoot -> mainSeq -> par(delay=indefinite) -> par(delay=0) ->
 *      par(clickEffect)` nesting PowerPoint's own COM-authored ground-truth
 *      fixture uses), each one's `p:set`/`p:animEffect` targeting the
 *      SmartArt shape with `p:graphicEl><p:dgm id="<node guid>"
 *      bldStep="sp"/></p:graphicEl>` for the node it reveals - in REVERSE
 *      node-list order (Gamma, then Beta, then Alpha), plus a
 *      `p:bldLst/p:bldGraphic/p:bldSub/a:bldDgm bld="one"` declaration so the
 *      SDK's own `extractGraphicBuilds` parse path recognises the staged
 *      diagram build.
 *
 * A click-count-based reveal would show Alpha first (the leading node-list
 * prefix); the authored-index reveal (this fixture's whole point) must show
 * Gamma first, then Gamma+Beta, then all three - see the spec.
 *
 * Re-runnable; the spec invokes it from globalSetup.
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type JSZipType from 'jszip';
import type { PptxElement, SmartArtPptxElement } from 'pptx-viewer-core';
import { PptxHandler } from 'pptx-viewer-core';

import { writeFixtureDeterministic } from './write-fixture';

// JSZip is a dependency of `pptx-viewer-core` (bundled, not re-exported) and
// not a direct dependency of the e2e harness; resolve it from the core
// package's own resolution scope, same as the other generators that
// post-process a saved package (`generate-chart-fixture.ts`, ...).
const coreRequire = createRequire(createRequire(import.meta.url).resolve('pptx-viewer-core'));
const JSZip = coreRequire('jszip') as {
	loadAsync: (typeof JSZipType)['loadAsync'];
} & (new () => JSZipType);

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Slide title - the contract the spec navigates by. */
export const SMARTART_BUILD_SLIDE_TITLE = 'SmartArt Build Reveal Slide';

/** Node texts, in AUTHORED (document) order. */
export const SMARTART_BUILD_NODE_TEXTS = ['Alpha', 'Beta', 'Gamma'] as const;

/**
 * REVEAL order the fixture's `p:timing` authors: the LAST node first, then
 * the middle, then the first - the opposite of document order, so a
 * count-based (leading-prefix) reveal and the authored-index reveal disagree
 * observably.
 */
export const SMARTART_BUILD_REVEAL_ORDER = ['Gamma', 'Beta', 'Alpha'] as const;

/** Native OOXML shape id (`p:cNvPr/@id`) pinned on the SmartArt graphic frame. */
const SMARTART_SHAPE_ID = '87';

/**
 * One discrete on-click reveal step for a single SmartArt node, mirroring the
 * exact `tmRoot -> mainSeq -> par(delay=indefinite) -> par(delay=0) ->
 * par(clickEffect)` nesting PowerPoint's own COM-authored ground truth uses
 * (see the module doc), extended with `p:graphicEl/p:dgm` per ECMA-376
 * S19.5.34 (`CT_TLGraphicalObjectBuildElement`) / S19.5.10
 * (`CT_TLBuildDiagram`).
 *
 * @param ids - Five unique `p:cTn`/`@id` values consumed by this step's five
 *   nesting levels (outer hold wrapper, inner hold wrapper, the click effect
 *   itself, the `p:set`'s behavior `p:cTn`, and the `p:animEffect`'s
 *   behavior `p:cTn`).
 */
function clickStepXml(
	ids: readonly [number, number, number, number, number],
	nodeGuid: string,
): string {
	const [outer, inner, click, setBhvr, effectBhvr] = ids;
	const spTgt =
		`<p:spTgt spid="${SMARTART_SHAPE_ID}">` +
		`<p:graphicEl><p:dgm id="${nodeGuid}" bldStep="sp"/></p:graphicEl>` +
		`</p:spTgt>`;
	return (
		`<p:par><p:cTn id="${outer}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst><p:childTnLst>` +
		`<p:par><p:cTn id="${inner}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>` +
		`<p:par><p:cTn id="${click}" presetID="10" presetClass="entr" presetSubtype="0" fill="hold" grpId="0" nodeType="clickEffect"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>` +
		`<p:set><p:cBhvr><p:cTn id="${setBhvr}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn><p:tgtEl>${spTgt}</p:tgtEl><p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>` +
		`<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="${effectBhvr}" dur="500"/><p:tgtEl>${spTgt}</p:tgtEl></p:cBhvr></p:animEffect>` +
		`</p:childTnLst></p:cTn></p:par>` +
		`</p:childTnLst></p:cTn></p:par>` +
		`</p:childTnLst></p:cTn></p:par>`
	);
}

/** Build the full `<p:timing>` tree: one click step per `nodeGuidsInRevealOrder` entry. */
function timingXml(nodeGuidsInRevealOrder: readonly string[]): string {
	const steps = nodeGuidsInRevealOrder
		.map((guid, i) => clickStepXml([3 + i * 5, 4 + i * 5, 5 + i * 5, 6 + i * 5, 7 + i * 5], guid))
		.join('');
	return (
		`<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>` +
		`<p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>` +
		`${steps}</p:childTnLst></p:cTn>` +
		`<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>` +
		`<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst>` +
		`</p:seq></p:childTnLst></p:cTn></p:par></p:tnLst>` +
		`<p:bldLst><p:bldGraphic spid="${SMARTART_SHAPE_ID}" grpId="0"><p:bldSub><a:bldDgm bld="one"/></p:bldSub></p:bldGraphic></p:bldLst>` +
		`</p:timing>`
	);
}

export async function generateSmartArtBuildFixture(): Promise<string> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'SmartArt Build Reveal Fixture',
		initialSlideCount: 0,
	});

	const smartArtElement: SmartArtPptxElement = {
		id: 'element-smartart-build',
		type: 'smartArt',
		shapeId: SMARTART_SHAPE_ID,
		x: 120,
		y: 200,
		width: 600,
		height: 350,
		smartArtData: {
			resolvedLayoutType: 'list',
			colorScheme: 'colorful1',
			style: 'flat',
			nodes: SMARTART_BUILD_NODE_TEXTS.map((text, i) => ({ id: `seed-node-${i}`, text })),
		},
	} as SmartArtPptxElement;

	const slideBuilder = createSlide('Blank')
		.addText(SMARTART_BUILD_SLIDE_TITLE, {
			x: 60,
			y: 60,
			width: 600,
			height: 80,
			fontSize: 32,
			bold: true,
		})
		.addElement(smartArtElement as PptxElement);
	data.slides.push(slideBuilder.build());

	// 1. Base save (no p:timing yet): fabricates the diagram data/drawing parts,
	// minting a fresh random `{GUID}` for every node/connection/transition via
	// `newSmartArtGuid()` (see `smartart-fabrication-data.ts`'s module doc).
	const baseBytes = await handler.save(data.slides);
	const zip = await JSZip.loadAsync(baseBytes);

	// 2. Determinism pass: `newSmartArtGuid()` is NOT seeded, so a plain re-run
	// of this generator would mint different ids every time - both the fixture
	// bytes AND which node each hand-authored `p:graphicEl` targets would drift
	// on every regeneration, defeating `writeFixtureDeterministic`'s "same
	// logical deck -> same bytes" contract (see its module doc). Collect every
	// fabricated guid across the fabricated parts, in stable first-appearance
	// order, and remap each to a fixed placeholder before anything reads one
	// back.
	const GUID_PARTS = ['ppt/diagrams/data1.xml', 'ppt/diagrams/drawing1.xml'] as const;
	const guidPattern =
		/\{[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\}/g;
	const guidParts = new Map<string, string>();
	for (const name of GUID_PARTS) {
		const file = zip.file(name);
		if (file) {
			guidParts.set(name, await file.async('string'));
		}
	}
	const guidMap = new Map<string, string>();
	for (const name of GUID_PARTS) {
		for (const match of (guidParts.get(name) ?? '').matchAll(guidPattern)) {
			if (!guidMap.has(match[0])) {
				guidMap.set(
					match[0],
					`{00000000-0000-4000-8000-${String(guidMap.size).padStart(12, '0')}}`,
				);
			}
		}
	}
	for (const [name, xml] of guidParts) {
		zip.file(
			name,
			xml.replace(guidPattern, (guid) => guidMap.get(guid) ?? guid),
		);
	}
	const deterministicBytes = await zip.generateAsync({ type: 'uint8array' });

	// 3. Reload the now-deterministic package to discover the fixed node ids.
	const reloaded = await new PptxHandler().load(deterministicBytes.buffer as ArrayBuffer);
	const reloadedSmartArt = reloaded.slides[0]?.elements.find(
		(el): el is SmartArtPptxElement => el.type === 'smartArt',
	);
	const nodes = reloadedSmartArt?.smartArtData?.nodes ?? [];
	const guidByText = new Map(nodes.map((n) => [n.text, n.id]));
	const guidsInRevealOrder = SMARTART_BUILD_REVEAL_ORDER.map((text) => {
		const guid = guidByText.get(text);
		if (!guid) {
			throw new Error(`fabricated SmartArt is missing a node for "${text}"`);
		}
		return guid;
	});

	// 4. Inject the hand-authored p:timing tree into the (only) slide, right
	// before the closing </p:sld> - the last legal position per CT_Slide's
	// child order (cSld, clrMapOvr, transition?, timing?, extLst?), and the SDK
	// save output has neither transition nor slide-level extLst to insert
	// ahead of.
	const slidePath = 'ppt/slides/slide1.xml';
	const slideXmlFile = zip.file(slidePath);
	if (!slideXmlFile) {
		throw new Error(`${slidePath} missing from the saved package`);
	}
	const slideXml = await slideXmlFile.async('string');
	if (!slideXml.includes('</p:sld>')) {
		throw new Error(`${slidePath} has no </p:sld> closing tag to inject p:timing before`);
	}
	const patchedXml = slideXml.replace('</p:sld>', `${timingXml(guidsInRevealOrder)}</p:sld>`);
	zip.file(slidePath, patchedXml);

	const bytes = await zip.generateAsync({
		type: 'uint8array',
		compression: 'DEFLATE',
		compressionOptions: { level: 9 },
	});

	const outPath = resolve(__dirname, 'smartart-build-reveal.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	await writeFixtureDeterministic(outPath, bytes);
	return outPath;
}

// Allow running directly (basename comparison; see the format-painter generator).
const invokedDirectly =
	typeof process !== 'undefined' &&
	process.argv[1] &&
	process.argv[1].endsWith('generate-smartart-build-fixture.ts');
if (invokedDirectly) {
	generateSmartArtBuildFixture()
		.then((p) => console.log(`Wrote ${p}`))
		.catch((err) => {
			console.error(err);
			process.exit(1);
		});
}

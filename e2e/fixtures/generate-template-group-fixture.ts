/**
 * Generates `template-group.pptx` and `template-mce.pptx`, two fixtures that
 * exist to close two corpus blind spots. Both were found by measurement, not by
 * guessing.
 *
 * ## 1. `template-group.pptx`: a layout group whose children are NOT all one tag
 *
 * `CT_GroupShape` document order is paint order at every depth, not just at the
 * top of the shape tree, and a save that regroups children by tag restacks
 * them. Across all 38 committed decks there are 22 `p:grpSp` in template parts
 * and **every one of them is homogeneous**, so a group-inclusive ordering check
 * could not tell a fixed pipeline from a broken one: it passed either way. The
 * agent who fixed the template ordering defect had to prove the recursion
 * worked by deleting it and watching a hand-written test fail, because no
 * fixture could witness it.
 *
 * Its `slideLayout1` therefore carries a group holding
 * `p:sp, p:cxnSp, p:sp, p:cxnSp` interleaved. Tag-bucketing that group yields
 * `p:sp, p:sp, p:cxnSp, p:cxnSp`, which the corpus invariants detect.
 *
 * ## 2. `template-mce.pptx`: an `mc:AlternateContent` in a template shape tree
 *
 * Measured across the same 38 decks: **zero** `mc:AlternateContent` anywhere in
 * the shape tree of any of the 524 layout / master / notesMaster /
 * handoutMaster parts. The near misses look like coverage and are not - the 87
 * envelopes in `solution-explorer.pptx` and friends are `p:sld`-level
 * TRANSITION envelopes handled by a different code path, and the only 3 inside
 * any shape tree sit deep in a `p:graphicFrame/a:graphicData`.
 *
 * So its layout carries a depth-0 envelope wrapping a shape, with both a
 * `mc:Choice` and a `mc:Fallback`. It currently reproduces a real defect and is
 * ledgered as such in the manifest.
 *
 * ## Why this is TWO decks and not one
 *
 * The known-defect ledger is keyed per fixture, so a deck carrying the MCE
 * defect has every template invariant excused for it - including the group
 * ordering the other half exists to prove. Putting both features in one deck
 * would have silently neutralised the witness it was written to be. So:
 * `template-group.pptx` carries the mixed group and is asserted outright, and
 * `template-mce.pptx` carries the envelope and is ledgered.
 *
 * Re-runnable; the e2e global setup invokes both before the suite runs.
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';

import { writeFixtureDeterministic } from './write-fixture';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Distinctive `p:cNvPr/@name` values, so assertions can name what they mean. */
export const GROUP_NAME = 'MixedTagLayoutGroup';
export const GROUP_CHILD_NAMES = ['GroupBox1', 'GroupLine1', 'GroupBox2', 'GroupLine2'] as const;
export const MCE_SHAPE_NAME = 'LayoutMceChoiceShape';

const MC_NS = 'http://schemas.openxmlformats.org/markup-compatibility/2006';

/** A plain text-box shape inside the group's child coordinate space. */
function childShapeXml(id: number, name: string, xEmu: number): string {
	return (
		`<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/>` +
		`<p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
		`<p:spPr><a:xfrm><a:off x="${xEmu}" y="0"/><a:ext cx="457200" cy="457200"/></a:xfrm>` +
		`<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
		`<a:solidFill><a:srgbClr val="4472C4"/></a:solidFill></p:spPr>` +
		`<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/>` +
		`<a:t>${name}</a:t></a:r></a:p></p:txBody></p:sp>`
	);
}

/** A connector, so the group's children are not all the same tag. */
function childConnectorXml(id: number, name: string, xEmu: number): string {
	return (
		`<p:cxnSp><p:nvCxnSpPr><p:cNvPr id="${id}" name="${name}"/>` +
		`<p:cNvCxnSpPr/><p:nvPr/></p:nvCxnSpPr>` +
		`<p:spPr><a:xfrm><a:off x="${xEmu}" y="0"/><a:ext cx="457200" cy="457200"/></a:xfrm>` +
		`<a:prstGeom prst="line"><a:avLst/></a:prstGeom>` +
		`<a:ln w="19050"><a:solidFill><a:srgbClr val="ED7D31"/></a:solidFill></a:ln>` +
		`</p:spPr></p:cxnSp>`
	);
}

/**
 * The mixed-tag group. Children interleave `p:sp` and `p:cxnSp` so that
 * regrouping by tag produces a different, detectable sequence.
 */
function mixedGroupXml(): string {
	const yEmu = 5029200;
	const children = [
		childShapeXml(201, GROUP_CHILD_NAMES[0], 0),
		childConnectorXml(202, GROUP_CHILD_NAMES[1], 457200),
		childShapeXml(203, GROUP_CHILD_NAMES[2], 914400),
		childConnectorXml(204, GROUP_CHILD_NAMES[3], 1371600),
	].join('');
	return (
		`<p:grpSp><p:nvGrpSpPr><p:cNvPr id="200" name="${GROUP_NAME}"/>` +
		`<p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>` +
		`<p:grpSpPr><a:xfrm><a:off x="457200" y="${yEmu}"/><a:ext cx="1828800" cy="457200"/>` +
		`<a:chOff x="0" y="0"/><a:chExt cx="1828800" cy="457200"/></a:xfrm></p:grpSpPr>` +
		`${children}</p:grpSp>`
	);
}

/**
 * A depth-0 `mc:AlternateContent` in the layout shape tree.
 *
 * `a14` (Office 2010 drawing) is a namespace a conforming consumer may not
 * understand, which is what makes the Choice/Fallback pair meaningful rather
 * than decorative.
 */
function mceEnvelopeXml(): string {
	const shape = (name: string, fill: string): string =>
		`<p:sp><p:nvSpPr><p:cNvPr id="210" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
		`<p:spPr><a:xfrm><a:off x="2743200" y="5029200"/><a:ext cx="914400" cy="457200"/></a:xfrm>` +
		`<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
		`<a:solidFill><a:srgbClr val="${fill}"/></a:solidFill></p:spPr>` +
		`<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US"/>` +
		`<a:t>${name}</a:t></a:r></a:p></p:txBody></p:sp>`;
	return (
		`<mc:AlternateContent xmlns:mc="${MC_NS}">` +
		`<mc:Choice xmlns:a14="http://schemas.microsoft.com/office/drawing/2010/main" Requires="a14">` +
		`${shape(MCE_SHAPE_NAME, '70AD47')}</mc:Choice>` +
		`<mc:Fallback>${shape('LayoutMceFallbackShape', 'A5A5A5')}</mc:Fallback>` +
		`</mc:AlternateContent>`
	);
}

/** Declare the `mc` prefix on the part root when it is not already there. */
function ensureMcNamespace(xml: string): string {
	if (xml.includes(`xmlns:mc="${MC_NS}"`)) {
		return xml;
	}
	return xml.replace('<p:sldLayout ', `<p:sldLayout xmlns:mc="${MC_NS}" `);
}

/** Resolve a rels `Target` to a normalized zip-internal path. */
function resolveRelTarget(ownerPath: string, target: string): string {
	if (target.startsWith('/')) {
		return target.substring(1);
	}
	if (target.startsWith('..')) {
		return `ppt/${target.replace(/^(\.\.\/)+/u, '')}`;
	}
	const ownerDir = ownerPath.substring(0, ownerPath.lastIndexOf('/') + 1);
	return `${ownerDir}${target}`;
}

/** First rels target owned by `ownerPath` whose path contains `marker`. */
async function findRelTarget(
	zip: JSZip,
	ownerPath: string,
	marker: string,
): Promise<string | undefined> {
	const ownerDir = ownerPath.substring(0, ownerPath.lastIndexOf('/') + 1);
	const ownerFile = ownerPath.substring(ownerPath.lastIndexOf('/') + 1);
	const relsXml = await zip.file(`${ownerDir}_rels/${ownerFile}.rels`)?.async('string');
	if (!relsXml) {
		return undefined;
	}
	for (const match of relsXml.matchAll(/Target="([^"]*)"/gu)) {
		if ((match[1] ?? '').includes(marker)) {
			return resolveRelTarget(ownerPath, match[1]);
		}
	}
	return undefined;
}

async function buildDeck(outName: string, title: string, extraSpTreeXml: string): Promise<string> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title,
		initialSlideCount: 0,
	});
	data.slides.push(
		createSlide('Blank')
			.addShape('rect', {
				x: 60,
				y: 60,
				width: 200,
				height: 120,
				fill: { type: 'solid', color: '#4472C4' },
				text: 'SLIDE-SHAPE',
				textStyle: { color: '#FFFFFF' },
			})
			.build(),
	);

	const zip = await JSZip.loadAsync(await handler.save(data.slides));
	const slidePath = Object.keys(zip.files).find((p) => /^ppt\/slides\/slide\d+\.xml$/u.test(p));
	if (!slidePath) {
		throw new Error('template-group fixture: no seeded slide part');
	}
	const layoutPath = await findRelTarget(zip, slidePath, 'slideLayout');
	if (!layoutPath) {
		throw new Error('template-group fixture: could not resolve the layout part');
	}

	const layoutXml = await zip.file(layoutPath)!.async('string');
	const patched = ensureMcNamespace(layoutXml).replace(
		'</p:spTree>',
		`${extraSpTreeXml}</p:spTree>`,
	);
	if (patched === layoutXml) {
		throw new Error(`${outName}: layout spTree patch did not apply`);
	}
	zip.file(layoutPath, patched);

	const bytes = await zip.generateAsync({ type: 'uint8array' });
	const outPath = resolve(__dirname, outName);
	mkdirSync(dirname(outPath), { recursive: true });
	await writeFixtureDeterministic(outPath, bytes);
	return outPath;
}

/** The mixed-tag layout group, asserted outright by the corpus invariants. */
export async function generateTemplateGroupFixture(): Promise<string> {
	return buildDeck('template-group.pptx', 'Template Group Fixture', mixedGroupXml());
}

/** The layout MCE envelope, which currently reproduces a known defect. */
export async function generateTemplateMceFixture(): Promise<string> {
	return buildDeck('template-mce.pptx', 'Template MCE Fixture', mceEnvelopeXml());
}

const invokedDirectly =
	typeof process !== 'undefined' &&
	process.argv[1] &&
	process.argv[1].endsWith('generate-template-group-fixture.ts');
if (invokedDirectly) {
	Promise.all([generateTemplateGroupFixture(), generateTemplateMceFixture()])
		.then((paths) => console.log(`Wrote ${paths.join(', ')}`))
		.catch((err) => {
			console.error(err);
			process.exit(1);
		});
}

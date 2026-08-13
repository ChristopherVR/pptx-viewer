/**
 * Generates `text-layout.pptx` - a single slide whose only job is to make
 * run-level text-layout divergence between the five bindings measurable.
 *
 * The coarse slide fingerprint (`e2e/support/fingerprint.ts`) samples one
 * "dominant" text node per element, so a body whose runs disagree, or whose
 * font-size is scaled by a feature only one binding implements, can still
 * fingerprint identically. Every shape here isolates one such property:
 *
 *  1. `AutofitTitle`   `a:normAutofit/@fontScale` - a shrink-on-overflow title.
 *  2. `NoWrapLine`     `a:bodyPr/@wrap="none"` - must never wrap.
 *  3. `UnstyledText`   no `sz`, no `a:latin` - the default-font fallback.
 *  4. `RunsAndBlanks`  two runs, an authored blank paragraph, a bullet.
 *  5. `LooseSpacing`   `a:lnSpc/a:spcPct` - an explicit 150% line height.
 *  6. `LinkedAndMaths` an `a:hlinkClick` run and an inline `m:oMath`, both of
 *     which shared's `ParagraphRun` did not model: Vue, Svelte and Vanilla
 *     dropped the LINK entirely (it rendered as prose) and dropped the EQUATION
 *     with the sentence around it (the whole element was handed to the
 *     standalone equation renderer).
 *
 * The text bodies are hand-authored OOXML rather than SDK-built, because the
 * builder has no surface for `normAutofit`, `wrap="none"` or a run with no
 * character properties at all, and those absences are precisely the inputs
 * under test. A blank SDK deck supplies the package around them.
 *
 * Re-runnable; `global-setup.ts` invokes it before every Playwright run.
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';

import { writeFixtureDeterministic } from './write-fixture';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Marker text per shape; specs locate elements by these. */
export const TEXT_LAYOUT_SHAPES = {
	autofit: 'Autofit title shrunk to seventy percent',
	noWrap: 'This line is authored wrap none and must stay on one line',
	unstyled: 'Unstyled paragraph with no authored size or typeface',
	runs: 'Alpha ',
	spacing: 'Loose spacing paragraph wrapping over more than a single line here',
	linked: 'the docs',
	maths: 'Given ',
} as const;

/** The `a:hlinkClick` target of the `LinkedAndMaths` shape's linked run. */
export const HYPERLINK_TARGET = 'https://example.com/docs';
/** Relationship id the hyperlink is authored against in `slide1.xml.rels`. */
const HYPERLINK_RID = 'rIdHlink1';

/** The authored `fontScale`, as a fraction. React is the only binding applying it. */
export const AUTOFIT_FONT_SCALE = 0.7;

const NS =
	'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
	'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
	'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

interface ShapeSpec {
	name: string;
	x: number;
	y: number;
	cx: number;
	cy: number;
	bodyPr: string;
	paragraphs: string;
}

function shape(id: number, spec: ShapeSpec): string {
	return (
		`<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${spec.name}"/>` +
		`<p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
		`<p:spPr><a:xfrm><a:off x="${spec.x}" y="${spec.y}"/>` +
		`<a:ext cx="${spec.cx}" cy="${spec.cy}"/></a:xfrm>` +
		`<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>` +
		`<p:txBody>${spec.bodyPr}<a:lstStyle/>${spec.paragraphs}</p:txBody></p:sp>`
	);
}

/** A run in Arial at `sz` hundredths of a point. */
function run(text: string, sz: number): string {
	return (
		`<a:r><a:rPr lang="en-US" sz="${sz}" dirty="0"><a:latin typeface="Arial"/>` +
		`<a:cs typeface="Arial"/></a:rPr><a:t>${text}</a:t></a:r>`
	);
}

const SHAPES: ShapeSpec[] = [
	{
		name: 'AutofitTitle',
		x: 457200,
		y: 274320,
		cx: 7315200,
		cy: 731520,
		// A real PowerPoint shrink-to-fit title: the authored 40pt is painted at
		// 28pt. Only React consults `fontScale`, so the other four paint it ~43%
		// larger than PowerPoint does.
		bodyPr: '<a:bodyPr wrap="square"><a:normAutofit fontScale="70000"/></a:bodyPr>',
		paragraphs: `<a:p>${run(TEXT_LAYOUT_SHAPES.autofit, 4000)}</a:p>`,
	},
	{
		name: 'NoWrapLine',
		x: 457200,
		y: 1188720,
		// Deliberately far narrower than the text: a binding that ignores
		// `wrap="none"` wraps it to three or four lines instead of one.
		cx: 2286000,
		cy: 731520,
		bodyPr: '<a:bodyPr wrap="none"><a:noAutofit/></a:bodyPr>',
		paragraphs: `<a:p>${run(TEXT_LAYOUT_SHAPES.noWrap, 1400)}</a:p>`,
	},
	{
		name: 'UnstyledText',
		x: 457200,
		y: 2103120,
		cx: 4572000,
		cy: 731520,
		bodyPr: '<a:bodyPr wrap="square"><a:noAutofit/></a:bodyPr>',
		// No `sz` and no `a:latin`: whatever each binding falls back to is what
		// the reader sees, and it must be the same size and the same metrics.
		paragraphs:
			`<a:p><a:r><a:rPr lang="en-US" dirty="0"/>` +
			`<a:t>${TEXT_LAYOUT_SHAPES.unstyled}</a:t></a:r></a:p>`,
	},
	{
		name: 'RunsAndBlanks',
		x: 457200,
		y: 3017520,
		cx: 4572000,
		cy: 1554480,
		bodyPr: '<a:bodyPr wrap="square"><a:noAutofit/></a:bodyPr>',
		// Two runs, then an authored blank paragraph, then a bulleted paragraph:
		// the run count must be identical everywhere, marker segments included.
		paragraphs:
			`<a:p>${run(TEXT_LAYOUT_SHAPES.runs, 1800)}${run('Beta', 1800)}</a:p>` +
			`<a:p><a:endParaRPr lang="en-US" sz="1800"/></a:p>` +
			`<a:p><a:pPr marL="342900" indent="-342900"><a:buChar char="•"/></a:pPr>` +
			`${run('Bulleted item', 1800)}</a:p>`,
	},
	{
		name: 'LinkedAndMaths',
		x: 457200,
		y: 4754880,
		cx: 5486400,
		cy: 1097280,
		bodyPr: '<a:bodyPr wrap="square"><a:noAutofit/></a:bodyPr>',
		// Paragraph 1: prose, a hyperlinked run, more prose. The link must reach
		// the DOM as a real anchor in every binding.
		// Paragraph 2: prose, an inline `m:oMath`, more prose. The maths must land
		// BETWEEN the two runs, and the prose must survive.
		paragraphs:
			`<a:p>${run('See ', 1400)}` +
			`<a:r><a:rPr lang="en-US" sz="1400" dirty="0">` +
			`<a:hlinkClick xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ` +
			`r:id="${HYPERLINK_RID}" tooltip="Documentation"/>` +
			`<a:latin typeface="Arial"/></a:rPr><a:t>${TEXT_LAYOUT_SHAPES.linked}</a:t></a:r>` +
			`${run(' for more', 1400)}</a:p>` +
			`<a:p>${run(TEXT_LAYOUT_SHAPES.maths, 1400)}` +
			'<m:oMath xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">' +
			'<m:r><m:t>x</m:t></m:r></m:oMath>' +
			`${run(' holds', 1400)}</a:p>`,
	},
	{
		name: 'LooseSpacing',
		x: 5715000,
		y: 3017520,
		cx: 2743200,
		cy: 1554480,
		bodyPr: '<a:bodyPr wrap="square"><a:noAutofit/></a:bodyPr>',
		paragraphs:
			`<a:p><a:pPr><a:lnSpc><a:spcPct val="150000"/></a:lnSpc></a:pPr>` +
			`${run(TEXT_LAYOUT_SHAPES.spacing, 1400)}</a:p>`,
	},
];

function slideXml(): string {
	return [
		'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
		`<p:sld ${NS}><p:cSld><p:spTree>`,
		'<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>',
		'<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/>',
		'<a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>',
		...SHAPES.map((spec, index) => shape(index + 2, spec)),
		'</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>',
	].join('');
}

export async function generateTextLayoutFixture(): Promise<string> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'Text Layout Fixture',
		initialSlideCount: 0,
	});
	data.slides.push(createSlide('Blank').build());
	const zip = await JSZip.loadAsync(await handler.save(data.slides));
	zip.file('ppt/slides/slide1.xml', slideXml());
	// The hyperlink run targets a relationship, so the part has to declare it.
	// Appended to whatever the SDK wrote (the layout relationship) rather than
	// replacing it, or the slide loses its layout.
	const relsPath = 'ppt/slides/_rels/slide1.xml.rels';
	const rels = (await zip.file(relsPath)?.async('string')) ?? '';
	zip.file(
		relsPath,
		rels.replace(
			'</Relationships>',
			`<Relationship Id="${HYPERLINK_RID}" ` +
				'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" ' +
				`Target="${HYPERLINK_TARGET}" TargetMode="External"/></Relationships>`,
		),
	);

	const outPath = resolve(__dirname, 'text-layout.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	await writeFixtureDeterministic(outPath, await zip.generateAsync({ type: 'uint8array' }));
	return outPath;
}

if (process.argv[1]?.endsWith('generate-text-layout-fixture.ts')) {
	generateTextLayoutFixture()
		.then((path) => console.log(`Wrote ${path}`))
		.catch((error) => {
			console.error(error);
			process.exit(1);
		});
}

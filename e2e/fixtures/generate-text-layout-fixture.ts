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
} as const;

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

/**
 * Generates `template-editing.pptx` -- a single-slide deck with one normal
 * slide-authored shape plus a decorative shape injected into the slide's
 * layout and into its master. Used by `../template-editing.spec.ts`, which
 * exercises `editTemplateMode` (edit inherited layout/master shapes directly
 * on the canvas) across every maintained viewer binding.
 *
 * The core slide loader only surfaces a layout/master shape as an editable
 * "template element" (`layout-` / `master-` prefixed id) when the
 * layout/master's own `p:spTree` actually contains a non-placeholder shape
 * (see `PptxHandlerRuntimeLayoutElements` / `PptxHandlerRuntimeMasterElements`
 * -- placeholders are always skipped). None of the SDK builder helpers expose
 * a way to author a decorative layout/master shape directly, so -- mirroring
 * `packages/core/src/__tests__/integration/template-element-editing-roundtrip.test.ts`
 * -- this builds a normal one-slide deck via the SDK, then patches the saved
 * ZIP's layout + master parts to inject one text-box shape into each.
 *
 * Re-runnable; the e2e global setup invokes it before the suite runs.
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';

import { writeFixtureDeterministic } from './write-fixture';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Distinctive text markers the e2e spec locates elements by. */
export const SLIDE_SHAPE_TEXT = 'SLIDE-SHAPE';
export const LAYOUT_SHAPE_TEXT = 'TPL-LAYOUT-ORIG';
export const MASTER_SHAPE_TEXT = 'TPL-MASTER-ORIG';

/**
 * Build a decorative `<p:sp>` (text box) at an EMU position, landing as a
 * sibling of the group envelope in a layout/master `p:spTree`.
 */
function decorativeShapeXml(
	id: number,
	name: string,
	xEmu: number,
	yEmu: number,
	text: string,
): string {
	return (
		`<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"></p:cNvPr>` +
		`<p:cNvSpPr></p:cNvSpPr><p:nvPr></p:nvPr></p:nvSpPr>` +
		`<p:spPr><a:xfrm><a:off x="${xEmu}" y="${yEmu}"></a:off>` +
		`<a:ext cx="1828800" cy="457200"></a:ext></a:xfrm>` +
		`<a:prstGeom prst="rect"><a:avLst></a:avLst></a:prstGeom></p:spPr>` +
		`<p:txBody><a:bodyPr></a:bodyPr><a:lstStyle></a:lstStyle>` +
		`<a:p><a:r><a:rPr lang="en-US"></a:rPr><a:t>${text}</a:t></a:r></a:p>` +
		`</p:txBody></p:sp>`
	);
}

/** Resolve a rels `Target` attribute to a normalized zip-internal path. */
function resolveRelTarget(ownerPath: string, target: string): string {
	if (target.startsWith('/')) {
		return target.substring(1);
	}
	if (target.startsWith('..')) {
		// Layout/master rels targets are one level up from their own directory,
		// e.g. "../slideMasters/slideMaster1.xml" from "ppt/slideLayouts/".
		return `ppt/${target.replace(/^(\.\.\/)+/u, '')}`;
	}
	const ownerDir = ownerPath.substring(0, ownerPath.lastIndexOf('/') + 1);
	return `${ownerDir}${target}`;
}

/** Find the first rels target (owned by `ownerPath`) whose path contains `marker`. */
async function findRelTarget(
	zip: JSZip,
	ownerPath: string,
	marker: string,
): Promise<string | undefined> {
	const ownerDir = ownerPath.substring(0, ownerPath.lastIndexOf('/') + 1);
	const ownerFile = ownerPath.substring(ownerPath.lastIndexOf('/') + 1);
	const relsPath = `${ownerDir}_rels/${ownerFile}.rels`;
	const relsXml = await zip.file(relsPath)?.async('string');
	if (!relsXml) {
		return undefined;
	}
	for (const match of relsXml.matchAll(/Target="([^"]*)"/gu)) {
		const target = match[1] ?? '';
		if (target.includes(marker)) {
			return resolveRelTarget(ownerPath, target);
		}
	}
	return undefined;
}

export async function generateFixture(): Promise<string> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'Template Editing Fixture',
		initialSlideCount: 0,
	});

	data.slides.push(
		createSlide('Blank')
			.addShape('rect', {
				x: 380,
				y: 200,
				width: 200,
				height: 140,
				fill: { type: 'solid', color: '#4472C4' },
				text: SLIDE_SHAPE_TEXT,
				textStyle: { color: '#FFFFFF' },
			})
			.build(),
	);

	const seed = await handler.save(data.slides);
	const zip = await JSZip.loadAsync(seed);

	const slidePath = Object.keys(zip.files).find((p) => /^ppt\/slides\/slide\d+\.xml$/u.test(p));
	if (!slidePath) {
		throw new Error('template-editing fixture: could not find the seeded slide part');
	}
	const layoutPath = await findRelTarget(zip, slidePath, 'slideLayout');
	if (!layoutPath) {
		throw new Error("template-editing fixture: could not resolve the seed slide's layout part");
	}
	const masterPath = await findRelTarget(zip, layoutPath, 'slideMaster');
	if (!masterPath) {
		throw new Error("template-editing fixture: could not resolve the layout's master part");
	}

	const layoutXml = await zip.file(layoutPath)!.async('string');
	const masterXml = await zip.file(masterPath)!.async('string');

	// Non-overlapping bands (EMU, 914400 per inch): master shape near the
	// top-left (~0.1in), layout shape near the bottom-left (~6.5in), well clear
	// of the slide-authored shape at (380,200)-(580,340)pt (~5.3in-8in x).
	const masterShape = decorativeShapeXml(91, 'MasterLogo', 91440, 91440, MASTER_SHAPE_TEXT);
	const layoutShape = decorativeShapeXml(90, 'LayoutLogo', 91440, 5943600, LAYOUT_SHAPE_TEXT);

	zip.file(masterPath, masterXml.replace('</p:spTree>', `${masterShape}</p:spTree>`));
	zip.file(layoutPath, layoutXml.replace('</p:spTree>', `${layoutShape}</p:spTree>`));

	const bytes = await zip.generateAsync({ type: 'uint8array' });
	const outPath = resolve(__dirname, 'template-editing.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	await writeFixtureDeterministic(outPath, bytes);
	return outPath;
}

// Allow running directly. The `import.meta.url` vs `process.argv[1]` shape
// differs subtly on Windows, so we just check whether this module is the
// entrypoint by comparing basenames.
const invokedDirectly =
	typeof process !== 'undefined' &&
	process.argv[1] &&
	process.argv[1].endsWith('generate-template-editing-fixture.ts');
if (invokedDirectly) {
	generateFixture()
		.then((p) => console.log(`Wrote ${p}`))
		.catch((err) => {
			console.error(err);
			process.exit(1);
		});
}

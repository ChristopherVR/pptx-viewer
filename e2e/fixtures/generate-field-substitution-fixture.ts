/**
 * Generates `field-substitution.pptx`: four slides that each print their own
 * slide number and their own title through OOXML field runs.
 *
 * A field run (`a:fld`) carries a cached literal in its `a:t` (PowerPoint
 * writes the value it last displayed, e.g. `#`) plus the field type that says
 * what the value should actually be. A viewer that renders the cached literal
 * instead of resolving the field shows `Slide #` where PowerPoint shows
 * `Slide 3`, and a viewer that resolves it against the wrong slide shows the
 * active slide's number on every thumbnail. Both defects have shipped in this
 * repo, in different bindings, and neither is visible on a one-slide deck or a
 * deck whose fields all resolve to the same value. Hence four slides, each with
 * a distinct title, each printing its own number.
 *
 * The SDK builder has no field API, so the deck is built normally with a marker
 * run and the field XML is spliced in afterwards, the same way
 * `generate-chart-fixture.ts` injects its chart parts.
 *
 * Re-runnable; global setup invokes it.
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type JSZipType from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';

import { writeFixtureDeterministic } from './write-fixture';

const __dirname = dirname(fileURLToPath(import.meta.url));

// JSZip ships inside `pptx-viewer-core` and is not a direct e2e dependency, so
// it is resolved from core's own scope (see the chart fixture generator).
const require = createRequire(import.meta.url);
const JSZip: typeof JSZipType = require(
	require.resolve('jszip', { paths: [dirname(require.resolve('pptx-viewer-core'))] }),
);

/** Slide titles, one per slide, so a mis-resolved title field is obvious. */
export const FIELD_SLIDE_TITLES = ['Alpha', 'Beta', 'Gamma', 'Delta'] as const;

/** The run text replaced by the field runs during the splice. */
const MARKER = 'FIELDMARKER';

/**
 * What each slide must display once fields resolve.
 *
 * The spec asserts on these rather than on raw numbers so that the expectation
 * and the fixture cannot drift apart.
 */
export function expectedFieldText(slideNumber: number): string {
	return `Slide ${slideNumber} - ${FIELD_SLIDE_TITLES[slideNumber - 1]}`;
}

/** `a:fld` runs for the slide number and the slide title, with cached literals. */
function fieldRunsXml(): string {
	const rPr = '<a:rPr lang="en-US" sz="2000" dirty="0"/>';
	// No digits in the literal runs: the only number on screen is then the one
	// the slide-number field resolved to, so a spec can assert on it without
	// matching some incidental digit in the surrounding text.
	const slideNum = `<a:fld id="{B4B0C1F0-0000-4000-A000-000000000001}" type="slidenum">${rPr}<a:t>#</a:t></a:fld>`;
	const slideTitle = `<a:fld id="{B4B0C1F0-0000-4000-A000-000000000002}" type="slidetitle">${rPr}<a:t>Title</a:t></a:fld>`;
	return `<a:r>${rPr}<a:t>Slide </a:t></a:r>${slideNum}<a:r>${rPr}<a:t> - </a:t></a:r>${slideTitle}`;
}

/** Replace the whole marker run with the field runs. */
function spliceFields(slideXml: string): string {
	const markerRun = new RegExp(`<a:r>(?:(?!</a:r>).)*${MARKER}(?:(?!</a:r>).)*</a:r>`, 'su');
	if (!markerRun.test(slideXml)) {
		throw new Error(`field-substitution fixture: no "${MARKER}" run to splice fields into`);
	}
	return slideXml.replace(markerRun, fieldRunsXml());
}

/**
 * Promote the first shape on the slide to a title placeholder.
 *
 * A `slidetitle` field resolves against whichever shape the deck declares as
 * its title, so without `p:ph type="title"` the field has nothing to resolve
 * to and every binding correctly renders the cached literal. The SDK builder
 * does not expose placeholder types, so the `p:nvPr` is patched here.
 */
function promoteFirstShapeToTitle(slideXml: string): string {
	const firstNvPr = slideXml.indexOf('<p:nvPr></p:nvPr>', slideXml.indexOf('<p:sp>'));
	if (firstNvPr === -1) {
		throw new Error('field-substitution fixture: no shape nvPr to mark as the title placeholder');
	}
	const before = slideXml.slice(0, firstNvPr);
	const after = slideXml.slice(firstNvPr + '<p:nvPr></p:nvPr>'.length);
	return `${before}<p:nvPr><p:ph type="title"/></p:nvPr>${after}`;
}

export async function generateFieldSubstitutionFixture(): Promise<string> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'Field Substitution Fixture',
		initialSlideCount: 0,
	});

	for (const title of FIELD_SLIDE_TITLES) {
		data.slides.push(
			createSlide('Title and Content')
				.addText(title, { x: 60, y: 40, width: 600, height: 80, fontSize: 36, bold: true })
				.addText(MARKER, { x: 60, y: 300, width: 600, height: 60, fontSize: 20 })
				.build(),
		);
	}

	const baseBytes = await handler.save(data.slides);

	const zip = await JSZip.loadAsync(baseBytes);
	for (let index = 0; index < FIELD_SLIDE_TITLES.length; index += 1) {
		const path = `ppt/slides/slide${index + 1}.xml`;
		const xml = await zip.file(path)!.async('string');
		zip.file(path, spliceFields(promoteFirstShapeToTitle(xml)));
	}

	const bytes = await zip.generateAsync({ type: 'uint8array' });
	const outPath = resolve(__dirname, 'field-substitution.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	await writeFixtureDeterministic(outPath, bytes);
	return outPath;
}

// Allow running directly; basename comparison, as the sibling generators do.
const invokedDirectly =
	typeof process !== 'undefined' &&
	process.argv[1] &&
	process.argv[1].endsWith('generate-field-substitution-fixture.ts');
if (invokedDirectly) {
	generateFieldSubstitutionFixture()
		.then((path) => console.log(`Wrote ${path}`))
		.catch((error) => {
			console.error(error);
			process.exit(1);
		});
}

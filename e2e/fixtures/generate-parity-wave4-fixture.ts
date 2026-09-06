/**
 * Deterministic fixture for the wave-4 presentation-parity UI: a deck that is
 * "read-only recommended" (`p:modifyVerifier`), carries a compatibility
 * warning (an unmodelled `p:presentation` child), an authored slide-range
 * show (`p:showPr/p:sldRg`), MRU colours (`p:clrMru`) and authored view
 * properties (`cSldViewPr` snap/guide flags + `gridSpacing`).
 *
 * The builder has no surface for any of these, so `presentation.xml`,
 * `presProps.xml` and `viewProps.xml` are patched in the saved package.
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { PptxHandler } from 'pptx-viewer-core';

import { writeFixtureDeterministic } from './write-fixture';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Text on each of the three slides, so a spec can tell which one is shown. */
export const WAVE4_SLIDE_TEXT = ['WAVE4-SLIDE-ONE', 'WAVE4-SLIDE-TWO', 'WAVE4-SLIDE-THREE'];
/** `p:sldRg` is 1-based and inclusive: the show runs slides 2..3 only. */
export const WAVE4_SLIDE_RANGE = { st: 2, end: 3 };
/** `p:clrMru` entries, most recent first, as the pickers should list them. */
export const WAVE4_MRU_COLORS = ['#FF6600', '#0066FF', '#33CC33'];
/** `p:gridSpacing` in EMU (0.5cm). */
export const WAVE4_GRID_SPACING = 180000;

// Deliberately WITHOUT `cryptAlgorithmSid` (or `algorithmName`/`algIdExt`):
// this fixture exists to exercise the plain "read-only recommended" banner +
// unconditional "Edit anyway" (plus the unrelated compat-warning/slide-range
// surfaces below), not password verification. `hashData`/`saltData` here are
// placeholder bytes, not a real hash of anything, so if a crypto-identifying
// attribute resolved to a real algorithm this verifier would look CHECKABLE
// (`requiresPassword: true`) with no password that could ever satisfy it,
// locking the deck for good and breaking every test past the banner assertion
// below. A REAL, checkable PowerPoint-authored verifier lives in
// `modify-password.pptx` (see `modify-password-prompt.spec.ts`).
const MODIFY_VERIFIER =
	'<p:modifyVerifier cryptProviderType="rsaAES" cryptAlgorithmClass="hash" ' +
	'cryptAlgorithmType="typeAny" spinCount="100000" ' +
	'saltData="Zm9v" hashData="YmFy"/>';

const VIEW_PROPS =
	'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
	'<p:viewPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
	'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
	'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">' +
	'<p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="94660"/></p:normalViewPr>' +
	'<p:slideViewPr><p:cSldViewPr snapToGrid="1" snapToObjects="1" showGuides="1">' +
	'<p:cViewPr varScale="1"><p:scale><a:sx n="70" d="100"/><a:sy n="70" d="100"/></p:scale>' +
	'<p:origin x="0" y="0"/></p:cViewPr>' +
	'<p:guideLst><p:guide orient="horz" pos="2160"/><p:guide pos="2880"/></p:guideLst>' +
	'</p:cSldViewPr></p:slideViewPr>' +
	`<p:gridSpacing cx="${WAVE4_GRID_SPACING}" cy="${WAVE4_GRID_SPACING}"/>` +
	'</p:viewPr>';

function patchPresentationXml(xml: string): string {
	// `p:modifyVerifier` sits after `p:defaultTextStyle` (before `p:extLst`);
	// an element outside the schema alongside it is what core reports as
	// UNMODELLED_PRESENTATION_MARKUP.
	const withVerifier = xml.includes('</p:defaultTextStyle>')
		? xml.replace('</p:defaultTextStyle>', `</p:defaultTextStyle>${MODIFY_VERIFIER}`)
		: xml.replace('</p:presentation>', `${MODIFY_VERIFIER}</p:presentation>`);
	return withVerifier.replace('</p:presentation>', '<p:wave4Unmodelled/></p:presentation>');
}

function patchPresPropsXml(xml: string): string {
	const showPr = `<p:showPr><p:present/><p:sldRg st="${WAVE4_SLIDE_RANGE.st}" end="${WAVE4_SLIDE_RANGE.end}"/></p:showPr>`;
	const clrMru = `<p:clrMru>${WAVE4_MRU_COLORS.map((hex) => `<a:srgbClr val="${hex.slice(1)}"/>`).join('')}</p:clrMru>`;
	const stripped = xml
		.replace(/<p:showPr>[\s\S]*?<\/p:showPr>/u, '')
		.replace(/<p:showPr\/>/u, '')
		.replace(/<p:clrMru>[\s\S]*?<\/p:clrMru>/u, '');
	const withNs = stripped.includes('xmlns:a=')
		? stripped
		: stripped.replace(
				'<p:presentationPr ',
				'<p:presentationPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ',
			);
	if (withNs.includes('<p:extLst>')) {
		return withNs.replace('<p:extLst>', `${showPr}${clrMru}<p:extLst>`);
	}
	if (withNs.includes('</p:presentationPr>')) {
		return withNs.replace('</p:presentationPr>', `${showPr}${clrMru}</p:presentationPr>`);
	}
	// A blank deck saves a self-closing `<p:presentationPr .../>`: open it up.
	const patched = withNs.replace(
		/<p:presentationPr([^>]*?)\/>/u,
		`<p:presentationPr$1>${showPr}${clrMru}</p:presentationPr>`,
	);
	if (patched === withNs) {
		throw new Error('could not patch presProps.xml: no p:presentationPr element found');
	}
	return patched;
}

export async function generateParityWave4Fixture(): Promise<string> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'Parity Wave 4 Fixture',
		initialSlideCount: 0,
	});
	for (const text of WAVE4_SLIDE_TEXT) {
		data.slides.push(
			createSlide('Blank').addText(text, { x: 100, y: 100, width: 600, height: 80 }).build(),
		);
	}
	const zip = await JSZip.loadAsync(await handler.save(data.slides));

	const presentationXml = await zip.file('ppt/presentation.xml')?.async('string');
	if (!presentationXml) {
		throw new Error('generated deck has no ppt/presentation.xml');
	}
	zip.file('ppt/presentation.xml', patchPresentationXml(presentationXml));

	const presPropsXml = await zip.file('ppt/presProps.xml')?.async('string');
	if (!presPropsXml) {
		throw new Error('generated deck has no ppt/presProps.xml');
	}
	zip.file('ppt/presProps.xml', patchPresPropsXml(presPropsXml));

	if (!zip.file('ppt/viewProps.xml')) {
		throw new Error('generated deck has no ppt/viewProps.xml');
	}
	zip.file('ppt/viewProps.xml', VIEW_PROPS);

	const outPath = resolve(__dirname, 'parity-wave4.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	await writeFixtureDeterministic(outPath, await zip.generateAsync({ type: 'uint8array' }));
	return outPath;
}

if (process.argv[1]?.endsWith('generate-parity-wave4-fixture.ts')) {
	generateParityWave4Fixture()
		.then((path) => console.log(`Wrote ${path}`))
		.catch((error: unknown) => {
			console.error(error);
			process.exit(1);
		});
}

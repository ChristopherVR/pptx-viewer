import { describe, expect, it } from 'vitest';

import {
	PPTX_OPEN_ACCEPT,
	PRESENTATION_OPEN_EXTENSIONS,
	isLegacyBinaryPresentation,
	isSupportedPresentationFile,
	presentationBaseName,
	savedPresentationFileName,
} from './presentation-file-kinds';

describe('the open allow-list', () => {
	/**
	 * The whole point of this module: legacy binary `.ppt` really loads (core
	 * converts the OLE compound file through the pptx pipeline, proved by
	 * `packages/core/src/__tests__/integration/ppt-import.test.ts`), so every
	 * surface that filters by extension has to let it through. A picker or a
	 * drop target that rejects it makes a working loader unreachable.
	 */
	it('advertises legacy binary .ppt alongside the OpenXML family', () => {
		expect(PRESENTATION_OPEN_EXTENSIONS).toContain('.ppt');
		expect(PPTX_OPEN_ACCEPT).toBe('.pptx,.ppsx,.pptm,.potx,.ppt,.json');
	});

	it('accepts every advertised extension, case-insensitively', () => {
		// Asserted as a mapped list rather than a loop of bare booleans, so a
		// failure names the extension that regressed.
		const rejected = PRESENTATION_OPEN_EXTENSIONS.filter(
			(extension) =>
				!isSupportedPresentationFile(`deck${extension}`) ||
				!isSupportedPresentationFile(`deck${extension.toUpperCase()}`),
		);
		expect(rejected).toStrictEqual([]);
	});

	it('also accepts the binary siblings that share the .ppt record format', () => {
		expect(isSupportedPresentationFile('show.pps')).toBeTruthy();
		expect(isSupportedPresentationFile('template.pot')).toBeTruthy();
	});

	it('rejects anything else, and a missing name', () => {
		expect(isSupportedPresentationFile('notes.pdf')).toBeFalsy();
		expect(isSupportedPresentationFile('deck.key')).toBeFalsy();
		expect(isSupportedPresentationFile('pptx')).toBeFalsy();
		expect(isSupportedPresentationFile('')).toBeFalsy();
		expect(isSupportedPresentationFile(null)).toBeFalsy();
		expect(isSupportedPresentationFile(undefined)).toBeFalsy();
	});

	it('matches on the file name, not on a directory that happens to end in .ppt', () => {
		expect(isSupportedPresentationFile('C:\\my.ppt\\notes.pdf')).toBeFalsy();
		expect(isSupportedPresentationFile('C:\\decks\\report.ppt')).toBeTruthy();
	});

	it('knows which of them are binary-family filenames (legacy .ppt is now also a save target)', () => {
		expect(isLegacyBinaryPresentation('report.ppt')).toBeTruthy();
		expect(isLegacyBinaryPresentation('report.pptx')).toBeFalsy();
		expect(isLegacyBinaryPresentation(undefined)).toBeFalsy();
	});
});

describe('the saved-copy name', () => {
	/**
	 * The default save format is OpenXML. Keeping a `.ppt` source's extension
	 * on an ordinary Save would hand the user a `.ppt` whose bytes are a ZIP,
	 * which PowerPoint refuses; explicitly picking the `'ppt'` format (see
	 * below) is the only way to get a `.ppt` byte-shape back out.
	 */
	it('turns a legacy .ppt source into a .pptx save name', () => {
		expect(savedPresentationFileName('report.ppt')).toBe('report.pptx');
		expect(savedPresentationFileName('C:\\decks\\report.PPT')).toBe('report.pptx');
	});

	it('re-extensions any source for the format actually being written', () => {
		expect(savedPresentationFileName('report.pptx', 'ppsx')).toBe('report.ppsx');
		expect(savedPresentationFileName('report.ppt', 'pptm')).toBe('report.pptm');
	});

	it('saves as legacy binary .ppt when that format is explicitly requested', () => {
		expect(savedPresentationFileName('report.pptx', 'ppt')).toBe('report.ppt');
	});

	it('falls back to presentation.pptx with no usable source name', () => {
		expect(savedPresentationFileName(undefined)).toBe('presentation.pptx');
		expect(savedPresentationFileName('   ')).toBe('presentation.pptx');
		expect(savedPresentationFileName(null)).toBe('presentation.pptx');
	});

	it('keeps a name with no recognised extension whole', () => {
		expect(presentationBaseName('Untitled Presentation')).toBe('Untitled Presentation');
		expect(presentationBaseName('v1.2 draft')).toBe('v1.2 draft');
	});
});

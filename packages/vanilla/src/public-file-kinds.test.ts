import { describe, expect, it } from 'vitest';

import { PPTX_OPEN_ACCEPT, isSupportedPresentationFile, renderToCanvas } from './index';

/**
 * The openable-file allow list has to be reachable from the PUBLIC surface.
 *
 * Every demo in this repo hand-rolled `/\.(?:pptx|ppt|json)$/iu` and
 * `accept=".pptx,.ppt,.json"`, so dragging `deck.pptm` onto a dropzone was
 * refused while opening the very same file through the viewer's own
 * File > Open worked. The fix is not "add pptm to five regexes"; it is to stop
 * hosts having to write the regex, which means the constant and the predicate
 * must be exported from here.
 */
describe('vanilla public file-kind surface', () => {
	it('exports the accept list and the loadable-file predicate', () => {
		expect(PPTX_OPEN_ACCEPT).toBe('.pptx,.ppsx,.pptm,.potx,.ppt,.json');
		expect(isSupportedPresentationFile).toBeTypeOf('function');
	});

	it('accepts every macro/show/template extension the loader handles', () => {
		for (const name of ['deck.pptm', 'deck.ppsx', 'deck.potx', 'deck.pps', 'deck.pot']) {
			expect(isSupportedPresentationFile(name)).toBeTruthy();
		}
	});

	it('still accepts the three the demos hard-coded, and rejects unrelated files', () => {
		expect(isSupportedPresentationFile('deck.pptx')).toBeTruthy();
		expect(isSupportedPresentationFile('deck.ppt')).toBeTruthy();
		expect(isSupportedPresentationFile('deck.json')).toBeTruthy();
		expect(isSupportedPresentationFile('deck.docx')).toBeFalsy();
		expect(isSupportedPresentationFile('')).toBeFalsy();
	});

	it('exports renderToCanvas, so a host export pipeline gets the same capture passes', () => {
		expect(renderToCanvas).toBeTypeOf('function');
	});
});

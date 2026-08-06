/**
 * The scaffolded starter apps must open every deck the viewer can read.
 *
 * `pptx-viewer-core` gained a legacy binary `.ppt` importer, and the five demo
 * apps were widened to match, but the five starter templates this CLI writes
 * still filtered to `.pptx` in two places each: the picker's `accept` list and
 * the drop handler's own extension check (a drop event gets no filtering from
 * `accept`, so both matter). A user scaffolding a new app and dropping a `.ppt`
 * on it saw nothing happen at all.
 *
 * These are template STRINGS, so a typo inside one is invisible until someone
 * scaffolds a project; the shape checks below are the cheapest way to keep the
 * five in step.
 */
import { describe, expect, it } from 'vitest';

import {
	ANGULAR_APP_TS,
	REACT_APP_TSX,
	SVELTE_APP_SVELTE,
	VANILLA_MAIN_TS,
	VUE_APP_VUE,
} from './index';

/** Every starter that renders the drag-and-drop landing screen. */
const LANDING_TEMPLATES: ReadonlyArray<[name: string, source: string]> = [
	['react', REACT_APP_TSX],
	['vue', VUE_APP_VUE],
	['angular', ANGULAR_APP_TS],
	['svelte', SVELTE_APP_SVELTE],
	['vanilla', VANILLA_MAIN_TS],
];

describe('scaffold landing templates', () => {
	it.each(LANDING_TEMPLATES)('%s offers both formats in the file picker', (_name, source) => {
		expect(source).toContain('.pptx,.ppt');
	});

	it.each(LANDING_TEMPLATES)('%s gates dropped files on both formats', (_name, source) => {
		expect(source).toContain('isPresentation');
		expect(source).toContain("name.endsWith('.pptx') || name.endsWith('.ppt')");
		// The old gate would silently ignore a dropped .ppt.
		expect(source).not.toContain("file?.name.endsWith('.pptx')");
	});

	it.each(LANDING_TEMPLATES)('%s tells the user which formats are accepted', (_name, source) => {
		expect(source).toMatch(/\.pptx (or|&amp;|ou) \.ppt|\.pptx or \.ppt/u);
	});

	it.each(LANDING_TEMPLATES)('%s closes every template literal it opens', (_name, source) => {
		// A stray backtick inside the emitted source (a JSDoc `code span`, say)
		// terminates the literal that carries it and the starter fails to build.
		// Counting unescaped backticks is a blunt but effective canary.
		const unescaped = source.split('').filter((char, index) => {
			return char === '`' && source[index - 1] !== '\\';
		});
		expect(unescaped.length % 2).toBe(0);
	});
});

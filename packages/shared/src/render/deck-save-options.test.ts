import { describe, expect, it } from 'vitest';

import { buildDeckSaveOptions } from './deck-save-options';
import type { DeckSaveState } from './deck-save-options';

function baseState(overrides: Partial<DeckSaveState> = {}): DeckSaveState {
	return {
		headerFooter: {},
		presentationProperties: {},
		customShows: [],
		sections: [],
		coreProperties: undefined,
		appProperties: undefined,
		customProperties: [],
		tagCollections: [],
		slideMasters: [],
		notesMaster: undefined,
		handoutMaster: undefined,
		tableStyleMap: undefined,
		tableStylesDefaultId: undefined,
		tableStylesToDelete: [],
		...overrides,
	};
}

describe('buildDeckSaveOptions', () => {
	it('omits array-valued fields when empty, matching every prior per-binding assembler', () => {
		const options = buildDeckSaveOptions(baseState());

		expect(options.customShows).toBeUndefined();
		expect(options.sections).toBeUndefined();
		expect(options.customProperties).toBeUndefined();
		expect(options.tags).toBeUndefined();
		expect(options.tableStyles).toBeUndefined();
		expect(options.tableStylesDefaultId).toBeUndefined();
		expect(options.tableStylesToDelete).toBeUndefined();
		// slideMasters is always passed (core only rewrites masters it is handed).
		expect(options.slideMasters).toStrictEqual([]);
	});

	it('passes populated array fields through', () => {
		const options = buildDeckSaveOptions(
			baseState({
				customShows: [{ id: 'cs1', name: 'Show 1', slideRIds: ['rId2'] }],
				sections: [{ id: 'sec1', name: 'Section 1', slideIds: ['s1'] }],
				customProperties: [{ name: 'Reviewed', value: 'true', type: 'bool' }],
				tagCollections: [{ path: 'ppt/tags/tag1.xml', tags: [{ name: 'k', value: 'v' }] }],
			}),
		);

		expect(options.customShows).toStrictEqual([{ id: 'cs1', name: 'Show 1', slideRIds: ['rId2'] }]);
		expect(options.sections).toStrictEqual([{ id: 'sec1', name: 'Section 1', slideIds: ['s1'] }]);
		expect(options.customProperties).toStrictEqual([
			{ name: 'Reviewed', value: 'true', type: 'bool' },
		]);
		expect(options.tags).toStrictEqual([
			{ path: 'ppt/tags/tag1.xml', tags: [{ name: 'k', value: 'v' }] },
		]);
	});

	it('passes viewProperties through unchanged (the field core silently drops if omitted)', () => {
		const options = buildDeckSaveOptions(baseState({ viewProperties: { showComments: true } }));
		expect(options.viewProperties).toStrictEqual({ showComments: true });
	});

	it('folds table style edits through tableStyleSaveOptions', () => {
		const options = buildDeckSaveOptions(
			baseState({
				tableStyleMap: { '{guid}': { styleId: '{guid}', styleName: 'Edited' } },
				tableStylesDefaultId: '{guid}',
				tableStylesToDelete: ['{deleted}'],
			}),
		);
		expect(options.tableStyles).toStrictEqual({
			'{guid}': { styleId: '{guid}', styleName: 'Edited' },
		});
		expect(options.tableStylesDefaultId).toBe('{guid}');
		expect(options.tableStylesToDelete).toStrictEqual(['{deleted}']);
	});

	it('defaults embedFonts to true (embedTrueTypeFonts set, no embeddedFontList override)', () => {
		const options = buildDeckSaveOptions(baseState());
		expect(options.embedTrueTypeFonts).toBeTruthy();
		expect(options.embeddedFontList).toBeUndefined();
	});

	it('strips embedded fonts when embedFonts is false', () => {
		const options = buildDeckSaveOptions(baseState({ embedFonts: false }));
		expect(options.embedTrueTypeFonts).toBeFalsy();
		expect(options.embeddedFontList).toBeNull();
	});

	it('passes an already-resolved slideSize and outputFormat through', () => {
		const options = buildDeckSaveOptions(
			baseState({
				slideSize: { widthEmu: 9144000, heightEmu: 6858000, type: 'screen4x3' },
				outputFormat: 'ppsx',
			}),
		);
		expect(options.slideSize).toStrictEqual({
			widthEmu: 9144000,
			heightEmu: 6858000,
			type: 'screen4x3',
		});
		expect(options.outputFormat).toBe('ppsx');
	});
});

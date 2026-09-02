import type { PptxPresentationProperties } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';

import { useRecentColors } from './useRecentColors';

/**
 * useRecentColors: the "Recent colours" row (`p:clrMru`, wave-4 B6). Seeds
 * from the loaded deck's `presentationProperties.mruColors` and folds a newly
 * picked colour back onto it, outside the undo stack.
 */
describe('useRecentColors', () => {
	it("seeds recent from the deck's own mruColors", () => {
		const presentationProperties = ref<PptxPresentationProperties>({
			mruColors: ['#112233'],
		});
		const { recent } = useRecentColors({ presentationProperties });
		expect(recent.value).toStrictEqual(['#112233']);
	});

	it('picking a colour puts it first and writes mruColors back', () => {
		const presentationProperties = ref<PptxPresentationProperties>({
			mruColors: ['#112233'],
		});
		const { recent, push } = useRecentColors({ presentationProperties });

		push('#445566');

		expect(recent.value).toStrictEqual(['#445566', '#112233']);
		expect(presentationProperties.value.mruColors).toStrictEqual(['#445566', '#112233']);
	});

	it('ignores a colour that is not a plain 6-digit hex value', () => {
		const presentationProperties = ref<PptxPresentationProperties>({ mruColors: ['#112233'] });
		const { recent, push } = useRecentColors({ presentationProperties });

		push('not-a-colour');

		expect(recent.value).toStrictEqual(['#112233']);
		expect(presentationProperties.value.mruColors).toStrictEqual(['#112233']);
	});

	it('re-seeds from the new deck on a fresh load (loadVersion bump)', () => {
		const presentationProperties = ref<PptxPresentationProperties>({ mruColors: ['#112233'] });
		const loadVersion = ref(0);
		const { recent, push } = useRecentColors({ presentationProperties, loadVersion });

		push('#445566');
		expect(recent.value).toStrictEqual(['#445566', '#112233']);

		// A new document loads: a fresh presentationProperties object and a
		// loadVersion bump, mirroring `useLoadContent`'s own load path.
		presentationProperties.value = { mruColors: ['#abcdef'] };
		loadVersion.value += 1;

		// seedRecentColors normalises to upper-case #RRGGBB.
		expect(recent.value).toStrictEqual(['#ABCDEF']);
	});
});

import { seedRecentColors } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';

import { applyRecentColorPick } from './useRecentColorsSync';

describe('useRecentColorsSync (wave-4 B6)', () => {
	it('seeds the row from the deck, then a pick puts the new colour first and writes mruColors back', () => {
		const seeded = seedRecentColors({ mruColors: ['#112233'] });
		expect(seeded).toStrictEqual(['#112233']);

		const applied = applyRecentColorPick(seeded, '#445566');
		expect(applied).not.toBeNull();
		expect(applied!.recentColors).toStrictEqual(['#445566', '#112233']);
		expect(applied!.patch).toStrictEqual({ mruColors: ['#445566', '#112233'] });
	});

	it('returns null for an invalid colour, so the caller can skip the state write', () => {
		expect(applyRecentColorPick(['#112233'], 'not-a-color')).toBeNull();
	});

	it('re-picking an already-recent colour moves it to the front instead of duplicating it', () => {
		const applied = applyRecentColorPick(['#112233', '#445566'], '#445566');
		expect(applied!.recentColors).toStrictEqual(['#445566', '#112233']);
	});
});

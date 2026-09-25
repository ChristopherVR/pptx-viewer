import { describe, expect, it } from 'vitest';

import { showDirectionPicker } from './animation-authoring';
import {
	DIRECTION_VALUES,
	DIRECTIONAL_PRESETS,
	directionValuesFor,
	directionValuesForPreset,
} from './animation-direction-options';

describe('animation direction options', () => {
	it('offers all eight directions for Fly and Crawl, the four edges for Wipe/Peek/Stretch', () => {
		expect(directionValuesForPreset('flyIn')).toBe(DIRECTION_VALUES);
		expect(directionValuesForPreset('crawlOut')).toHaveLength(8);
		for (const preset of ['wipeIn', 'wipeOut', 'peekIn', 'peekOut', 'stretchIn']) {
			expect(directionValuesForPreset(preset)).toStrictEqual([
				'fromTop',
				'fromBottom',
				'fromLeft',
				'fromRight',
			]);
		}
	});

	it('offers nothing for presets PowerPoint has no direction variant for', () => {
		// Float In (presetID 30) saves one subtype only.
		expect(directionValuesForPreset('floatIn')).toStrictEqual([]);
		expect(directionValuesForPreset('fadeIn')).toStrictEqual([]);
		expect(DIRECTIONAL_PRESETS.has('floatIn')).toBeFalsy();
	});

	it("uses the entrance's directions, else the exit's", () => {
		const anims = [
			{ elementId: 'a', entrance: 'fadeIn' as const, exit: 'wipeOut' as const },
			{ elementId: 'b', entrance: 'flyIn' as const, exit: 'wipeOut' as const },
		];
		expect(directionValuesFor(anims, 'a')).toHaveLength(4);
		expect(directionValuesFor(anims, 'b')).toHaveLength(8);
		expect(directionValuesFor(anims, 'missing')).toStrictEqual([]);
		expect(showDirectionPicker(anims, 'a')).toBeTruthy();
		expect(showDirectionPicker([{ elementId: 'c', entrance: 'floatIn' }], 'c')).toBeFalsy();
	});
});

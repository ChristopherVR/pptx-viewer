/**
 * table-cell-advanced-fill.component.test.ts: the cell pattern picker.
 *
 * Two defects meet in this control. It printed the `a:pattFill/@prst` token
 * verbatim, so a user chose between `ltHorz` and `narVert`; and its fallback
 * preset (`ltDnDiag`) is not in the 20-preset slice it offered, so a cell
 * carrying it rendered a `<select>` whose value matched no `<option>`. The
 * browser then displayed the first entry, and the next change committed that
 * unrelated preset over a fill the user never touched.
 *
 * No TestBed in this package's suite, so this asserts the option list the
 * template iterates and the keys it spells the options with.
 */
import { describe, expect, it } from 'vitest';

import { PATTERN_OPTIONS } from '../internal/shared';
import { keyToLabel, translationsEn } from '../internal/shared-src/i18n';
import { fillPatternLabelKey } from './schema-token-labels';
import { DEFAULT_PATTERN_FILL_PRESET, patternPresetOptions } from './table-properties-helpers';

function renderedLabel(key: string): string {
	return (translationsEn as Record<string, string | undefined>)[key] ?? keyToLabel(key);
}

describe('patternPresetOptions', () => {
	it('offers the shared catalogue unchanged for a preset that is on it', () => {
		expect(patternPresetOptions('pct5')).toStrictEqual([...PATTERN_OPTIONS]);
	});

	it('keeps the fallback preset representable', () => {
		// The regression: 'ltDnDiag' is index 27 of the 56 OOXML presets, and the
		// picker offers the first 20, so the seeded value had no option of its own.
		expect(PATTERN_OPTIONS).not.toContain(DEFAULT_PATTERN_FILL_PRESET);
		expect(patternPresetOptions(undefined)).toContain(DEFAULT_PATTERN_FILL_PRESET);
		expect(patternPresetOptions(DEFAULT_PATTERN_FILL_PRESET)).toContain(
			DEFAULT_PATTERN_FILL_PRESET,
		);
	});

	it('keeps any off-catalogue preset a deck carries representable', () => {
		const options = patternPresetOptions('zigZag');

		expect(options).toContain('zigZag');
		// Appended, so the offered catalogue itself is untouched.
		expect(options.slice(0, PATTERN_OPTIONS.length)).toStrictEqual([...PATTERN_OPTIONS]);
		expect(options).toHaveLength(PATTERN_OPTIONS.length + 1);
	});

	it('never duplicates a preset', () => {
		for (const preset of [undefined, 'pct5', 'ltDnDiag', 'narVert', 'zigZag']) {
			const options = patternPresetOptions(preset);
			expect(new Set(options).size).toBe(options.length);
		}
	});
});

describe('pattern option spelling', () => {
	it('spells every offered preset instead of printing its token', () => {
		for (const preset of patternPresetOptions(undefined)) {
			expect(renderedLabel(fillPatternLabelKey(preset))).not.toBe(preset);
		}
	});

	it('uses the wording the reference binding uses', () => {
		expect(renderedLabel(fillPatternLabelKey('pct5'))).toBe('5%');
		expect(renderedLabel(fillPatternLabelKey('ltHorz'))).toBe('Light Horizontal');
		expect(renderedLabel(fillPatternLabelKey('narVert'))).toBe('Narrow Vertical');
		expect(renderedLabel(fillPatternLabelKey('ltDnDiag'))).toBe('Light Down Diagonal');
	});

	it('leaves the option values in wire spelling', () => {
		// These strings are written into the saved file, so relabelling must not
		// touch them.
		expect([...PATTERN_OPTIONS].slice(0, 3)).toStrictEqual(['pct5', 'pct10', 'pct20']);
	});
});

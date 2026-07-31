/**
 * slide-theme-override-panel.component.test.ts: the per-slide colour-map
 * override rows.
 *
 * Each row maps a logical alias (`bg1`, `accent3`) to a theme slot, and the
 * slot picker used to list `dk1` / `folHlink` verbatim: a raw wire token next
 * to a friendly alias name in the same row. The values the picker writes are a
 * file-format contract (they land in `a:overrideClrMapping`), so this pins that
 * the relabelling left the offered set untouched.
 *
 * No TestBed in this package's suite, so this asserts the option values and the
 * keys the template spells them with.
 */
import { COLOR_MAP_ALIAS_KEYS, THEME_COLOR_SCHEME_KEYS } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { keyToLabel, translationsEn } from '../internal/shared-src/i18n';
import { themeColorSlotLabelKey } from './schema-token-labels';
import {
	COLOR_MAP_ALIAS_LABEL_KEYS,
	createIdentityColorMapOverride,
} from './slide-theme-override-panel.component';

function renderedLabel(key: string): string {
	return (translationsEn as Record<string, string | undefined>)[key] ?? keyToLabel(key);
}

describe('colour-map override slot picker', () => {
	it('still offers every theme slot as an option value', () => {
		expect([...THEME_COLOR_SCHEME_KEYS]).toStrictEqual([
			'dk1',
			'lt1',
			'dk2',
			'lt2',
			'accent1',
			'accent2',
			'accent3',
			'accent4',
			'accent5',
			'accent6',
			'hlink',
			'folHlink',
		]);
	});

	it('spells each option instead of printing the slot token', () => {
		const texts = THEME_COLOR_SCHEME_KEYS.map((slot) =>
			renderedLabel(themeColorSlotLabelKey(slot)),
		);

		expect(texts[0]).toBe('Dark 1');
		expect(texts.at(-1)).toBe('Followed Hyperlink');
		expect(texts).not.toContain('folHlink');
	});

	it('keeps writing the raw slot token as the option value', () => {
		// The identity override is what the toggle seeds, and it must stay in wire
		// spelling: these strings are written straight into the saved file.
		expect(createIdentityColorMapOverride()).toMatchObject({ bg1: 'lt1', tx1: 'dk1' });
	});
});

describe('colour-map alias row labels', () => {
	it('spells every alias exactly as the reference binding does', () => {
		const labels = Object.fromEntries(
			COLOR_MAP_ALIAS_KEYS.map((alias) => [
				alias,
				renderedLabel(COLOR_MAP_ALIAS_LABEL_KEYS[alias]),
			]),
		);

		expect(labels).toStrictEqual({
			bg1: 'Background 1',
			tx1: 'Text 1',
			bg2: 'Background 2',
			tx2: 'Text 2',
			accent1: 'Accent 1',
			accent2: 'Accent 2',
			accent3: 'Accent 3',
			accent4: 'Accent 4',
			accent5: 'Accent 5',
			accent6: 'Accent 6',
			hlink: 'Hyperlink',
			folHlink: 'Followed Hyperlink',
		});
	});

	it('translates the eight aliases the shared catalogue covers', () => {
		// bg1/tx1/bg2/tx2 name the colour MAP rather than a theme slot and have no
		// dictionary key yet, so they stay literals; the rest must be keys, or the
		// row label would be stuck in English.
		expect(COLOR_MAP_ALIAS_LABEL_KEYS.accent1).toBe('pptx.themeColor.accent1');
		expect(COLOR_MAP_ALIAS_LABEL_KEYS.folHlink).toBe('pptx.themeColor.followedHyperlink');
		expect(COLOR_MAP_ALIAS_LABEL_KEYS.bg1).toBe('Background 1');
	});
});

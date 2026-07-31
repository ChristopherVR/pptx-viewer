/**
 * theme-editor-fields.component.test.ts: the theme editor's colour swatches.
 *
 * The swatches used to be captioned (and tooltipped) with the raw `a:clrScheme`
 * child name, so the editor asked users to recognise `dk1` and `folHlink`. They
 * are now spelled from the shared catalogue, and both halves of that need
 * pinning: the wording a user reads, and the slot set behind it, which must not
 * shift while the wording changes (each swatch writes the slot it names).
 *
 * No TestBed in this package's suite, so this asserts the module-level slot
 * list the template iterates and the keys it captions them with.
 */
import { describe, expect, it } from 'vitest';

import { keyToLabel, translationsEn } from '../internal/shared-src/i18n';
import { themeColorSlotLabelKey } from './schema-token-labels';
import { THEME_EDITOR_COLOR_SLOTS } from './theme-editor-fields.component';

function renderedLabel(key: string): string {
	return (translationsEn as Record<string, string | undefined>)[key] ?? keyToLabel(key);
}

describe('theme editor colour swatches', () => {
	it('still offers exactly the 12 schema slots, in schema order', () => {
		expect(THEME_EDITOR_COLOR_SLOTS).toStrictEqual([
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

	it('captions every slot with a word rather than its wire token', () => {
		const captions = THEME_EDITOR_COLOR_SLOTS.map((slot) =>
			renderedLabel(themeColorSlotLabelKey(String(slot))),
		);

		expect(captions).toStrictEqual([
			'Dark 1',
			'Light 1',
			'Dark 2',
			'Light 2',
			'Accent 1',
			'Accent 2',
			'Accent 3',
			'Accent 4',
			'Accent 5',
			'Accent 6',
			'Hyperlink',
			'Followed Hyperlink',
		]);
		// The caption is also the swatch's tooltip and its accessible name, so no
		// slot may fall back to the token it is meant to hide.
		expect(captions).not.toContain('dk1');
	});
});

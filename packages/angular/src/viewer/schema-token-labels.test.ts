/**
 * schema-token-labels.test.ts: the wire-token spelling layer.
 *
 * These assertions are the cheap half of "no user ever sees `folHlink`". The
 * package's suite is deliberately TestBed-free, so a test cannot read an
 * `<option>` out of a rendered template; what it can do is resolve the key a
 * template asks for through the exact fallback chain the Angular host uses
 * (shared dictionary, then `keyToLabel`) and pin the English that comes out.
 */
import { describe, expect, it } from 'vitest';

import { keyToLabel, translationsEn } from '../internal/shared-src/i18n';
import {
	arrowSizeLabelKey,
	fillPatternLabelKey,
	schemaLabelKey,
	smartArtColorSchemeLabelKey,
	smartArtLayoutLabelKey,
	smartArtStyleLabelKey,
	themeColorSlotLabelKey,
} from './schema-token-labels';

/** The text a template renders for `key`, resolved the way the host does. */
function renderedLabel(key: string): string {
	return (translationsEn as Record<string, string | undefined>)[key] ?? keyToLabel(key);
}

describe('schemaLabelKey', () => {
	it('maps a token to its dictionary key', () => {
		expect(schemaLabelKey({ dk1: 'pptx.themeColor.dark1' }, 'dk1')).toBe('pptx.themeColor.dark1');
	});

	it('hands back an unmapped token rather than blanking the control', () => {
		// A deck may carry a value newer than the catalogue; showing it keeps the
		// control honest instead of making it look broken.
		expect(schemaLabelKey({ dk1: 'pptx.themeColor.dark1' }, 'someNewToken')).toBe('someNewToken');
	});

	it('renders nothing for an absent token', () => {
		expect(schemaLabelKey({}, undefined)).toBe('');
	});
});

describe('theme colour slots', () => {
	it('spells every slot as PowerPoint does, not as the schema does', () => {
		const spelled = Object.fromEntries(
			(['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent6', 'hlink', 'folHlink'] as const).map(
				(slot) => [slot, renderedLabel(themeColorSlotLabelKey(slot))],
			),
		);

		expect(spelled).toStrictEqual({
			dk1: 'Dark 1',
			lt1: 'Light 1',
			dk2: 'Dark 2',
			lt2: 'Light 2',
			accent1: 'Accent 1',
			accent6: 'Accent 6',
			hlink: 'Hyperlink',
			folHlink: 'Followed Hyperlink',
		});
	});
});

describe('smartArt tokens', () => {
	it('spells colour variations', () => {
		expect(renderedLabel(smartArtColorSchemeLabelKey('colorful1'))).toBe('Colourful 1');
		expect(renderedLabel(smartArtColorSchemeLabelKey('monochromatic2'))).toBe('Monochromatic 2');
	});

	it('spells style intensities', () => {
		expect(renderedLabel(smartArtStyleLabelKey('flat'))).toBe('Flat');
		expect(renderedLabel(smartArtStyleLabelKey('intense'))).toBe('Intense');
	});

	it('spells layout families, including the nine that had no key before', () => {
		expect(renderedLabel(smartArtLayoutLabelKey('list'))).toBe('List');
		expect(renderedLabel(smartArtLayoutLabelKey('bending'))).toBe('Bending');
		expect(renderedLabel(smartArtLayoutLabelKey('venn'))).toBe('Venn');
	});
});

describe('arrowhead sizes', () => {
	it('spells the three schema steps as words', () => {
		expect(renderedLabel(arrowSizeLabelKey('sm'))).toBe('Small');
		expect(renderedLabel(arrowSizeLabelKey('med'))).toBe('Medium');
		expect(renderedLabel(arrowSizeLabelKey('lg'))).toBe('Large');
	});
});

describe('fill patterns', () => {
	it('spells percentage and diagonal presets', () => {
		expect(renderedLabel(fillPatternLabelKey('pct5'))).toBe('5%');
		expect(renderedLabel(fillPatternLabelKey('ltDnDiag'))).toBe('Light Down Diagonal');
		expect(renderedLabel(fillPatternLabelKey('narVert'))).toBe('Narrow Vertical');
	});
});

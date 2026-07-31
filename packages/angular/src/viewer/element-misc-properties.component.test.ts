/**
 * element-misc-properties.component.test.ts: the connector arrow pickers.
 *
 * The arrow width and length selects listed `sm` / `med` / `lg`: the literal
 * `a:headEnd/@w` and `@len` attribute values, offered to the user as if they
 * were words. Those values are a file-format contract, so the relabelling must
 * leave them exactly where they were.
 *
 * No TestBed in this package's suite, so this asserts the value list the
 * template iterates, the keys it spells them with, and the style patch the
 * change handler builds from a picked value.
 */
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { keyToLabel, translationsEn } from '../internal/shared-src/i18n';
import { ARROW_SIZE_VALUES, connectorStylePatch } from './element-misc-properties.component';
import { arrowSizeLabelKey } from './schema-token-labels';

function renderedLabel(key: string): string {
	return (translationsEn as Record<string, string | undefined>)[key] ?? keyToLabel(key);
}

describe('arrow size picker', () => {
	it('still offers the three schema steps as its values', () => {
		expect([...ARROW_SIZE_VALUES]).toStrictEqual(['sm', 'med', 'lg']);
	});

	it('spells each step as a word', () => {
		expect(ARROW_SIZE_VALUES.map((size) => renderedLabel(arrowSizeLabelKey(size)))).toStrictEqual([
			'Small',
			'Medium',
			'Large',
		]);
	});

	it('writes the wire token, not the label, into the element style', () => {
		const element = { id: 'c1', type: 'connector' } as unknown as PptxElement;

		expect(connectorStylePatch(element, { connectorStartArrowWidth: 'lg' })).toStrictEqual({
			shapeStyle: { connectorStartArrowWidth: 'lg' },
		});
	});
});

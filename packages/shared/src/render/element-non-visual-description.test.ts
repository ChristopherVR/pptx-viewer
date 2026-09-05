import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	getNonVisualDescriptionFields,
	supportsAltTextField,
	supportsTitleField,
} from './element-non-visual-description';

function makeElement(overrides: Partial<PptxElement> & { type: PptxElement['type'] }): PptxElement {
	return {
		id: 'el-1',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		...overrides,
	} as PptxElement;
}

describe('supportsAltTextField', () => {
	it('is true for a shape, text box and connector', () => {
		expect(supportsAltTextField('shape')).toBeTruthy();
		expect(supportsAltTextField('text')).toBeTruthy();
		expect(supportsAltTextField('connector')).toBeTruthy();
	});

	it('is true for a picture and every graphic-frame kind', () => {
		expect(supportsAltTextField('image')).toBeTruthy();
		expect(supportsAltTextField('picture')).toBeTruthy();
		expect(supportsAltTextField('table')).toBeTruthy();
		expect(supportsAltTextField('chart')).toBeTruthy();
		expect(supportsAltTextField('smartArt')).toBeTruthy();
		expect(supportsAltTextField('ole')).toBeTruthy();
		expect(supportsAltTextField('media')).toBeTruthy();
	});

	it('is false for kinds with no descr field, like a group', () => {
		expect(supportsAltTextField('group')).toBeFalsy();
		expect(supportsAltTextField('ink')).toBeFalsy();
	});
});

describe('supportsTitleField', () => {
	it('is true for a shape, text box, connector and every graphic-frame kind', () => {
		expect(supportsTitleField('shape')).toBeTruthy();
		expect(supportsTitleField('text')).toBeTruthy();
		expect(supportsTitleField('connector')).toBeTruthy();
		expect(supportsTitleField('table')).toBeTruthy();
		expect(supportsTitleField('chart')).toBeTruthy();
		expect(supportsTitleField('smartArt')).toBeTruthy();
		expect(supportsTitleField('ole')).toBeTruthy();
		expect(supportsTitleField('media')).toBeTruthy();
	});

	it('is false for a picture, which has no title field', () => {
		expect(supportsTitleField('image')).toBeFalsy();
		expect(supportsTitleField('picture')).toBeFalsy();
	});
});

describe('getNonVisualDescriptionFields', () => {
	it('returns altText and title for a shape', () => {
		const el = makeElement({ type: 'shape', altText: 'A red rectangle', title: 'Callout' });
		const fields = getNonVisualDescriptionFields(el);
		expect(fields).toStrictEqual({
			showAltText: true,
			showTitle: true,
			altText: 'A red rectangle',
			title: 'Callout',
		});
	});

	it('returns altText only (no title) for a picture', () => {
		const el = makeElement({ type: 'picture', altText: 'A sunset photo' });
		const fields = getNonVisualDescriptionFields(el);
		expect(fields.showAltText).toBeTruthy();
		expect(fields.showTitle).toBeFalsy();
		expect(fields.altText).toBe('A sunset photo');
		expect(fields.title).toBe('');
	});

	it('defaults to empty strings when unset', () => {
		const el = makeElement({ type: 'text' });
		const fields = getNonVisualDescriptionFields(el);
		expect(fields.altText).toBe('');
		expect(fields.title).toBe('');
	});

	it('hides both fields for a kind that supports neither', () => {
		const el = makeElement({ type: 'group', children: [] } as unknown as PptxElement);
		const fields = getNonVisualDescriptionFields(el);
		expect(fields.showAltText).toBeFalsy();
		expect(fields.showTitle).toBeFalsy();
		expect(fields.altText).toBe('');
		expect(fields.title).toBe('');
	});
});

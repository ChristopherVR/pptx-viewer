// @vitest-environment jsdom

import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { applyRenderedElementAccessibility } from './element-accessibility-dom';

const base = { x: 0, y: 0, width: 100, height: 50 };

describe('applyRenderedElementAccessibility', () => {
	it('applies names and roles to rendered elements', () => {
		const stage = document.createElement('div');
		stage.innerHTML = '<div data-element-id="title"></div><div data-element-id="photo"></div>';
		const elements = [
			{ ...base, id: 'title', type: 'text', text: 'Quarterly results' },
			{ ...base, id: 'photo', type: 'image', altText: 'Team photo' },
		] as PptxElement[];
		expect(applyRenderedElementAccessibility(stage, elements)).toBe(2);
		expect(stage.querySelector('[data-element-id="title"]')?.getAttribute('role')).toBe('group');
		expect(stage.querySelector('[data-element-id="title"]')?.getAttribute('aria-label')).toBe(
			'Quarterly results',
		);
		expect(stage.querySelector('[data-element-id="photo"]')?.getAttribute('role')).toBe('img');
	});

	it('includes nested group children', () => {
		const stage = document.createElement('div');
		stage.innerHTML = '<div data-element-id="group"><div data-element-id="child"></div></div>';
		const elements = [
			{
				...base,
				id: 'group',
				type: 'group',
				children: [{ ...base, id: 'child', type: 'shape', shapeType: 'ellipse' }],
			},
		] as PptxElement[];
		expect(applyRenderedElementAccessibility(stage, elements)).toBe(2);
		expect(stage.querySelector('[data-element-id="child"]')?.getAttribute('aria-label')).toBe(
			'Shape: ellipse',
		);
	});
});

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

	it('announces an action-carrying shape as a button, like React does', () => {
		const stage = document.createElement('div');
		stage.innerHTML = '<div data-element-id="cta"></div><div data-element-id="link"></div>';
		const elements = [
			{
				...base,
				id: 'cta',
				type: 'shape',
				shapeType: 'roundRect',
				actionClick: { url: 'https://example.com' },
			},
			{
				...base,
				id: 'link',
				type: 'text',
				text: 'Docs',
				textSegments: [{ text: 'Docs', style: { hyperlink: 'https://example.com' } }],
			},
		] as PptxElement[];
		applyRenderedElementAccessibility(stage, elements);
		expect(stage.querySelector('[data-element-id="cta"]')?.getAttribute('role')).toBe('button');
		expect(stage.querySelector('[data-element-id="link"]')?.getAttribute('role')).toBe('button');
		// The name and role-description still come from the element type.
		expect(
			stage.querySelector('[data-element-id="cta"]')?.getAttribute('aria-roledescription'),
		).toBe('shape: roundRect');
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

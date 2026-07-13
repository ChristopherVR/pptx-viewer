import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	buildSaveSlides,
	findTemplateElement,
	isElementIdInteractive,
	partitionTemplateElements,
	setTemplateElements,
} from './template-editing';

const element = (id: string): PptxElement =>
	({ id, type: 'shape', x: 0, y: 0, width: 10, height: 10 }) as PptxElement;
const slide = (elements: PptxElement[]): PptxSlide => ({ id: 'slide-1', elements }) as PptxSlide;

describe('template editing helpers', () => {
	it('partitions inherited elements and merges edited values for save', () => {
		const input = [slide([element('master-bg'), element('layout-title'), element('shape-1')])];
		const partition = partitionTemplateElements(input);
		expect(partition.slides[0].elements.map(({ id }) => id)).toStrictEqual(['shape-1']);
		expect(partition.templateElementsBySlideId['slide-1'].map(({ id }) => id)).toStrictEqual([
			'master-bg',
			'layout-title',
		]);

		partition.templateElementsBySlideId['slide-1'][1] = {
			...partition.templateElementsBySlideId['slide-1'][1],
			x: 42,
		};
		const saved = buildSaveSlides(partition.slides, partition.templateElementsBySlideId);
		expect(saved[0].elements.map(({ id }) => id)).toStrictEqual([
			'master-bg',
			'layout-title',
			'shape-1',
		]);
		expect(saved[0].elements[1].x).toBe(42);
	});

	it('preserves slide identity when no template elements exist', () => {
		const original = slide([element('shape-1')]);
		const partition = partitionTemplateElements([original]);
		expect(partition.slides[0]).toBe(original);
		expect(buildSaveSlides(partition.slides, {})[0]).toBe(original);
	});

	it('supports immutable lookup updates and interaction gating', () => {
		const original = { 'slide-1': [element('layout-title')] };
		const updated = setTemplateElements(original, 'slide-1', [element('master-bg')]);
		expect(updated).not.toBe(original);
		expect(findTemplateElement(updated, 'slide-1', 'master-bg')?.id).toBe('master-bg');
		expect(isElementIdInteractive('layout-title', false)).toBeFalsy();
		expect(isElementIdInteractive('layout-title', true)).toBeTruthy();
		expect(isElementIdInteractive('shape-1', false)).toBeTruthy();
	});
});

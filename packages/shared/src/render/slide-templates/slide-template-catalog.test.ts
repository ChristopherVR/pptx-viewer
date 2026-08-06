import { describe, expect, it } from 'vitest';

import {
	SLIDE_TEMPLATES,
	SLIDE_TEMPLATE_IDS,
	buildSlideTemplateContent,
	buildSlideTemplateSlide,
} from './slide-template-catalog';

const ELEMENT_TYPES = new Set([
	'text',
	'shape',
	'image',
	'table',
	'chart',
	'connector',
	'group',
	'smartArt',
	'media',
	'ink',
	'ole',
]);

describe('slide template catalog', () => {
	it('lists 12 templates with name and description keys', () => {
		expect(SLIDE_TEMPLATES).toHaveLength(12);
		for (const spec of SLIDE_TEMPLATES) {
			expect(spec.nameKey).toBe(`pptx.slideTemplates.${spec.id}.name`);
			expect(spec.descriptionKey).toBe(`pptx.slideTemplates.${spec.id}.description`);
		}
		expect(new Set(SLIDE_TEMPLATE_IDS).size).toBe(SLIDE_TEMPLATES.length);
	});

	it.each(SLIDE_TEMPLATE_IDS.map((id) => [id] as const))(
		'%s builds schema-valid elements within slide bounds',
		(id) => {
			const { elements, backgroundColor } = buildSlideTemplateContent(id);
			expect(backgroundColor).toMatch(/^#[0-9a-fA-F]{6}$/);
			for (const el of elements) {
				expect(ELEMENT_TYPES.has(el.type)).toBeTruthy();
				for (const value of [el.x, el.y, el.width, el.height]) {
					expect(Number.isFinite(value)).toBeTruthy();
				}
				expect(el.width).toBeGreaterThan(0);
				expect(el.height).toBeGreaterThan(0);
				expect(el.x).toBeGreaterThanOrEqual(0);
				expect(el.y).toBeGreaterThanOrEqual(0);
				expect(el.x + el.width).toBeLessThanOrEqual(1280 + 0.001);
				expect(el.y + el.height).toBeLessThanOrEqual(720 + 0.001);
				expect(el.id).not.toBe('');
			}
			const ids = elements.map((el) => el.id);
			expect(new Set(ids).size).toBe(ids.length);
		},
	);

	it('every template except blank has starter content', () => {
		for (const id of SLIDE_TEMPLATE_IDS) {
			const { elements } = buildSlideTemplateContent(id);
			if (id === 'blank') {
				expect(elements).toHaveLength(0);
			} else {
				expect(elements.length).toBeGreaterThan(0);
			}
		}
	});

	it('scales to a non-default canvas and stays in bounds', () => {
		const { elements } = buildSlideTemplateContent('timeline', {
			slideWidth: 960,
			slideHeight: 540,
		});
		for (const el of elements) {
			expect(el.x + el.width).toBeLessThanOrEqual(960 + 0.001);
			expect(el.y + el.height).toBeLessThanOrEqual(540 + 0.001);
		}
	});

	it('resolves theme scheme colours and stashes schemeClr round-trip nodes', () => {
		const { elements } = buildSlideTemplateContent('title', {
			scheme: { accent1: '#FF0000', tx1: '#112233' },
		});
		const bar = elements.find((el) => el.name === 'Accent Bar');
		expect(bar).toBeDefined();
		if (bar && (bar.type === 'shape' || bar.type === 'text')) {
			expect(bar.shapeStyle?.fillColor).toBe('#FF0000');
			expect(bar.shapeStyle?.fillColorXml).toStrictEqual({
				'a:schemeClr': { '@_val': 'accent1' },
			});
		}
		const title = elements.find((el) => el.name === 'Title');
		expect(title).toBeDefined();
		if (title && (title.type === 'text' || title.type === 'shape')) {
			expect(title.textStyle?.color).toBe('#112233');
			expect(title.textStyle?.colorXml).toStrictEqual({ 'a:schemeClr': { '@_val': 'tx1' } });
		}
	});

	it('falls back to the Office default scheme when no scheme is given', () => {
		const { elements } = buildSlideTemplateContent('sectionHeader');
		const panel = elements.find((el) => el.name === 'Section Panel');
		expect(panel).toBeDefined();
		if (panel && panel.type === 'shape') {
			expect(panel.shapeStyle?.fillColor).toBe('#4472C4');
		}
	});

	it('uses the provided translator for placeholder content', () => {
		const { elements } = buildSlideTemplateContent('title', {
			translate: (key) => `[${key}]`,
		});
		const title = elements.find((el) => el.name === 'Title');
		expect(title?.text).toBe('[pptx.slideTemplates.content.presentationTitle]');
	});

	it('defaults placeholder content to the canonical English dictionary', () => {
		const { elements } = buildSlideTemplateContent('closing');
		const thanks = elements.find((el) => el.name === 'Closing Title');
		expect(thanks?.text).toBe('Thank You');
	});

	it('builds a complete draft PptxSlide with the given identity', () => {
		const slide = buildSlideTemplateSlide('agenda', 'slide-test-1', 4, {
			idFor: (i) => `el-${i}`,
		});
		expect(slide.id).toBe('slide-test-1');
		expect(slide.slideNumber).toBe(4);
		expect(slide.elements.length).toBeGreaterThan(0);
		expect(slide.elements[0]?.id).toBe('el-0');
		expect(slide.backgroundColor).toBe('#FFFFFF');
	});
});

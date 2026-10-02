import { describe, expect, it } from 'vitest';

import {
	HOME_CROP_ITEMS,
	HOME_SHAPE_ITEMS,
	arrangePainterHomeControls,
	arrangeShapeHomeControls,
	canRequestHome,
	drawingHomeControls,
	fontFamilyItems,
	fontHomeControls,
	fontPickerHomeControls,
	homeFamilyKeys,
	homeGalleryApply,
	homeGalleryControls,
	paragraphHomeControls,
	parseCropValue,
	slidesHomeControls,
	withHomeGalleries,
} from './ribbon-home-state';

const font = {
	enabled: true,
	bold: false,
	italic: false,
	underline: false,
	strikethrough: false,
	shadow: false,
};

describe('font picker state', () => {
	it('groups the catalogue, translates headings and labels theme faces by role', () => {
		const rows = fontFamilyItems(
			{ themeFonts: { heading: 'Georgia', body: 'Calibri' } },
			(key) => `t:${key}`,
		);
		expect(rows[0]).toMatchObject({ value: 'Georgia', group: expect.stringContaining('t:') });
		expect(rows[0].description).toBe('t:pptx.font.role.heading');
		expect(rows[1].description).toBe('t:pptx.font.role.body');
		expect(rows.every((row) => row.fontFamily === row.value)).toBeTruthy();
	});

	it('disables both fields together and carries the shown values', () => {
		const controls = fontPickerHomeControls(
			{ enabled: false, fontFamily: 'Calibri', fontSize: 18 },
			(key) => key,
		);
		expect(controls['home.font.fontFamily']).toMatchObject({ disabled: true, value: 'Calibri' });
		expect(controls['home.font.fontSize']).toMatchObject({ disabled: true, value: '18' });
	});
});

describe('font and paragraph extras state', () => {
	it('gates every text extra on one enabled flag and keeps the highlight themeless', () => {
		const controls = fontHomeControls({
			...font,
			enabled: false,
			characterSpacing: 75,
			fontColor: { value: '#112233', themeColors: { dk1: '#000000' }, recent: ['#ffffff'] },
			highlight: { value: '#ffff00', themeColors: { dk1: '#000000' } },
		});
		for (const id of ['characterSpacing', 'changeCase', 'fontColor', 'highlightColor'] as const) {
			expect(controls[`home.font.${id}`]?.disabled).toBeTruthy();
		}
		expect(controls['home.font.characterSpacing']?.value).toBe('75');
		expect(controls['home.font.fontColor']?.colour?.recent).toStrictEqual(['#ffffff']);
		expect(controls['home.font.highlightColor']?.colour?.themeColors).toBeUndefined();
	});

	it('reflects the list kind and the menu values with defaults', () => {
		const controls = paragraphHomeControls({ enabled: true, list: 'numbered', columns: 2 });
		expect(controls['home.paragraph.bullets']?.pressed).toBeFalsy();
		expect(controls['home.paragraph.numbering']?.pressed).toBeTruthy();
		expect(controls['home.paragraph.lineSpacing']?.value).toBe('1');
		expect(controls['home.paragraph.columns']?.value).toBe('2');
		expect(controls['home.paragraph.textDirection']?.value).toBe('horizontal');
		expect(
			paragraphHomeControls({ enabled: true })['home.paragraph.bullets']?.pressed,
		).toBeUndefined();
	});
});

describe('galleries in a Home family', () => {
	const context = { element: null };

	it('builds one descriptor per gallery control and merges it into the gating', () => {
		const galleries = homeGalleryControls('paragraph', context, true);
		expect(Object.keys(galleries)).toStrictEqual([
			'home.paragraph.bullets',
			'home.paragraph.numbering',
		]);
		expect(galleries['home.paragraph.bullets']?.gallery?.descriptor?.id).toBe('bullets');
		const merged = withHomeGalleries(paragraphHomeControls({ enabled: false }), galleries, true);
		expect(merged['home.paragraph.bullets']).toMatchObject({ disabled: true, pressed: undefined });
		expect(merged['home.paragraph.bullets']?.gallery).toBeTruthy();
	});

	it('only applies tiles of controls that carry a gallery', () => {
		expect(homeGalleryApply('paragraph', 'home.paragraph.justify', 'x', context)).toBeUndefined();
		expect(homeGalleryApply('drawing', 'home.drawing.shapes', 'x', context)).toBeUndefined();
	});
});

describe('arrange shape and painter state', () => {
	const base = {
		editable: true,
		canGroup: false,
		canUngroup: false,
		canMerge: false,
		canCrop: false,
		cropActive: true,
		canStrokeWidth: true,
		strokeWidth: 3,
	};

	it('gates Merge and Crop on edit rights plus the selection and carries pressed and width', () => {
		const controls = arrangeShapeHomeControls({ ...base, canMerge: true, canCrop: true });
		expect(controls['home.arrange.mergeShapes']?.disabled).toBeFalsy();
		expect(controls['home.arrange.crop']).toMatchObject({ disabled: false, pressed: true });
		expect(controls['home.arrange.crop#caret']?.pressed).toBeUndefined();
		expect(controls['home.arrange.outlineWidth']).toMatchObject({ disabled: false, value: 3 });
		const locked = arrangeShapeHomeControls({ ...base, editable: false, canMerge: true });
		expect(locked['home.arrange.mergeShapes']?.disabled).toBeTruthy();
		expect(
			arrangeShapeHomeControls({ ...base, hideCrop: true })['home.arrange.crop']?.hidden,
		).toBeTruthy();
	});

	it('keeps the painter armed to cancel and hides it when the host offers none', () => {
		const armed = arrangePainterHomeControls({
			editable: true,
			active: true,
			canFormatPaint: false,
			show: true,
		});
		expect(armed['home.clipboard.formatPainter']).toMatchObject({ disabled: false, pressed: true });
		const hidden = arrangePainterHomeControls({
			editable: true,
			active: false,
			canFormatPaint: true,
			show: false,
		});
		expect(hidden['home.clipboard.formatPainter']?.hidden).toBeTruthy();
	});

	it('decodes crop menu values', () => {
		expect(parseCropValue('aspect:16:9')).toStrictEqual({ kind: 'aspect', width: 16, height: 9 });
		expect(parseCropValue('fill')).toStrictEqual({ kind: 'fill' });
		expect(parseCropValue('nope')).toBeUndefined();
		expect(HOME_CROP_ITEMS.map((row) => row.value)).toContain('aspect:16:9');
	});
});

describe('intent validation for new kinds', () => {
	it('accepts only listed menu and select values', () => {
		const state = { controls: drawingHomeControls({ editable: true, hasSelection: true }) };
		const pick = (id: 'home.drawing.shapes' | 'home.drawing.arrange', value: string) =>
			canRequestHome('drawing', state, { id, value });
		expect(pick('home.drawing.shapes', 'ellipse')).toBeTruthy();
		expect(pick('home.drawing.shapes', 'nope')).toBeFalsy();
		expect(pick('home.drawing.arrange', 'front')).toBeTruthy();
		expect(HOME_SHAPE_ITEMS).toHaveLength(12);
	});

	it('accepts only hex colours and bounded numbers', () => {
		const colourState = {
			controls: drawingHomeControls({ editable: true, hasSelection: true }),
		};
		const colour = (value: string) =>
			canRequestHome('drawing', colourState, { id: 'home.drawing.shapeFill', value });
		expect(colour('#a1b2c3')).toBeTruthy();
		expect(colour('red')).toBeFalsy();
		expect(colour('#12')).toBeFalsy();
		const state = {
			controls: arrangeShapeHomeControls({
				editable: true,
				canGroup: true,
				canUngroup: true,
				canMerge: true,
				canCrop: true,
				cropActive: false,
				canStrokeWidth: true,
				strokeWidth: 1,
			}),
		};
		const width = (value: number | string) =>
			canRequestHome('arrange-shape', state, { id: 'home.arrange.outlineWidth', value });
		expect(width(4)).toBeTruthy();
		expect(width(121)).toBeFalsy();
		expect(width(Number.NaN)).toBeFalsy();
		expect(width('4')).toBeFalsy();
	});

	it('accepts only layouts the gallery lists and rejects a value on a plain button', () => {
		const controls = slidesHomeControls({
			editable: true,
			hasLayouts: true,
			hasSlides: true,
			showTemplates: true,
			newSlideNeedsLayout: true,
			resetNeedsSlide: false,
			layouts: { layouts: [{ path: 'a.xml', name: 'A' }] },
		});
		const pick = (value: string) =>
			canRequestHome('slides', { controls }, { id: 'home.slides.layout', value });
		expect(pick('a.xml')).toBeTruthy();
		expect(pick('b.xml')).toBeFalsy();
		expect(
			canRequestHome('slides', { controls }, { id: 'home.slides.reset', value: 'a.xml' }),
		).toBeFalsy();
	});
});

describe('locale keys of the new strips', () => {
	it('lists every static label so snapshot translators track them', () => {
		const keys = homeFamilyKeys('arrange-shape');
		expect(keys).toContain('pptx.shape.mergeShapesHint');
		expect(keys).toContain('pptx.image.cropFill');
		expect(keys).toContain('pptx.image.cropSquare');
		expect(homeFamilyKeys('font-picker')).toContain('pptx.ribbon.fontFamily');
		expect(homeFamilyKeys('slides')).toContain('pptx.layoutGallery.empty');
	});
});

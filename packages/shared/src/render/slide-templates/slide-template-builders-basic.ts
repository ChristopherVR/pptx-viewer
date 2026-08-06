/**
 * slide-template-builders-basic.ts: builders for the structural starter
 * slides: title, title-and-content, section header, title-only, blank, and
 * the closing slide. Layout is authored in EMU on the 16:9 reference canvas.
 */

import type { PptxElement } from 'pptx-viewer-core';

import {
	TEMPLATE_CONTENT_WIDTH_EMU as CONTENT_W,
	TEMPLATE_MARGIN_EMU as MARGIN,
	TEMPLATE_REF_WIDTH_EMU as REF_W,
	templateShape,
	templateText,
} from './slide-template-helpers';
import type { SlideTemplateBuildContext } from './slide-template-types';

/** Shared title-band frame used by content templates. */
const TITLE_FRAME = { x: MARGIN, y: 420000, w: CONTENT_W, h: 900000 };
/** Thin accent underline sitting below the title band. */
const TITLE_RULE_FRAME = { x: MARGIN, y: 1420000, w: 1600000, h: 60000 };

/** Title band + accent rule shared by every "title at the top" template. */
export function buildTitleBand(ctx: SlideTemplateBuildContext, title: string): PptxElement[] {
	return [
		templateText(ctx, TITLE_FRAME, title, {
			name: 'Title',
			fontSize: 32,
			colorKey: 'tx1',
			bold: true,
			align: 'left',
			vAlign: 'bottom',
		}),
		templateShape(ctx, TITLE_RULE_FRAME, { name: 'Title Rule', fillKey: 'accent1' }),
	];
}

/** Title slide: large title, accent bar, subtitle. */
export function buildTitleSlide(ctx: SlideTemplateBuildContext): PptxElement[] {
	return [
		templateText(
			ctx,
			{ x: MARGIN, y: 2300000, w: CONTENT_W, h: 1300000 },
			ctx.t('presentationTitle'),
			{ name: 'Title', fontSize: 44, colorKey: 'tx1', bold: true, align: 'left', vAlign: 'bottom' },
		),
		templateShape(
			ctx,
			{ x: MARGIN, y: 3760000, w: 2200000, h: 80000 },
			{ name: 'Accent Bar', fillKey: 'accent1' },
		),
		templateText(
			ctx,
			{ x: MARGIN, y: 3980000, w: CONTENT_W, h: 640000 },
			ctx.t('presentationSubtitle'),
			{ name: 'Subtitle', fontSize: 20, colorKey: 'tx2', align: 'left', vAlign: 'top' },
		),
	];
}

/** Title and content: title band plus a bulleted body area. */
export function buildTitleAndContentSlide(ctx: SlideTemplateBuildContext): PptxElement[] {
	const body = ['point1', 'point2', 'point3'].map((key) => `• ${ctx.t(key)}`).join('\n');
	return [
		...buildTitleBand(ctx, ctx.t('slideTitle')),
		templateText(ctx, { x: MARGIN, y: 1720000, w: CONTENT_W, h: 4400000 }, body, {
			name: 'Content',
			fontSize: 18,
			colorKey: 'tx1',
			align: 'left',
			vAlign: 'top',
			lineSpacing: 1.6,
		}),
	];
}

/** Section header: full-height accent panel, section number, and title. */
export function buildSectionHeaderSlide(ctx: SlideTemplateBuildContext): PptxElement[] {
	return [
		templateShape(
			ctx,
			{ x: 0, y: 0, w: 4000000, h: 6858000 },
			{ name: 'Section Panel', fillKey: 'accent1' },
		),
		templateText(ctx, { x: 500000, y: 2650000, w: 3000000, h: 1500000 }, '01', {
			name: 'Section Number',
			fontSize: 60,
			colorKey: 'lt1',
			bold: true,
			align: 'left',
			vAlign: 'middle',
		}),
		templateText(
			ctx,
			{ x: 4500000, y: 2750000, w: REF_W - 4500000 - MARGIN, h: 1100000 },
			ctx.t('sectionTitle'),
			{
				name: 'Section Title',
				fontSize: 36,
				colorKey: 'tx1',
				bold: true,
				align: 'left',
				vAlign: 'bottom',
			},
		),
		templateText(
			ctx,
			{ x: 4500000, y: 3980000, w: REF_W - 4500000 - MARGIN, h: 700000 },
			ctx.t('sectionCaption'),
			{ name: 'Section Caption', fontSize: 16, colorKey: 'tx2', align: 'left', vAlign: 'top' },
		),
	];
}

/** Title only: just the title band. */
export function buildTitleOnlySlide(ctx: SlideTemplateBuildContext): PptxElement[] {
	return buildTitleBand(ctx, ctx.t('slideTitle'));
}

/** Blank: no starter elements at all. */
export function buildBlankSlide(): PptxElement[] {
	return [];
}

/** Closing slide: centred thank-you message with accent bar and contact line. */
export function buildClosingSlide(ctx: SlideTemplateBuildContext): PptxElement[] {
	return [
		templateText(ctx, { x: MARGIN, y: 2450000, w: CONTENT_W, h: 1300000 }, ctx.t('thankYou'), {
			name: 'Closing Title',
			fontSize: 44,
			colorKey: 'tx1',
			bold: true,
			align: 'center',
			vAlign: 'bottom',
		}),
		templateShape(
			ctx,
			{ x: REF_W / 2 - 1100000, y: 3900000, w: 2200000, h: 80000 },
			{ name: 'Accent Bar', fillKey: 'accent1' },
		),
		templateText(ctx, { x: MARGIN, y: 4150000, w: CONTENT_W, h: 640000 }, ctx.t('contactLine'), {
			name: 'Contact',
			fontSize: 16,
			colorKey: 'tx2',
			align: 'center',
			vAlign: 'top',
		}),
	];
}

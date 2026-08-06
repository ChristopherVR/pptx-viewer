/**
 * slide-template-builders-content.ts: builders for the content-heavy starter
 * slides: agenda, two-content, comparison, quote, timeline, and key metrics.
 * Layout is authored in EMU on the 16:9 reference canvas.
 */

import type { PptxElement } from 'pptx-viewer-core';

import { buildTitleBand } from './slide-template-builders-basic';
import {
	TEMPLATE_CONTENT_WIDTH_EMU as CONTENT_W,
	TEMPLATE_MARGIN_EMU as MARGIN,
	templateShape,
	templateText,
} from './slide-template-helpers';
import type { SlideTemplateBuildContext } from './slide-template-types';

/** Gap between side-by-side panels. */
const PANEL_GAP = 320000;
/** Width of one of two side-by-side panels. */
const HALF_PANEL_W = (CONTENT_W - PANEL_GAP) / 2;
/** X of the right-hand panel of a pair. */
const RIGHT_PANEL_X = MARGIN + HALF_PANEL_W + PANEL_GAP;

/** Agenda: numbered rows with divider rules. */
export function buildAgendaSlide(ctx: SlideTemplateBuildContext): PptxElement[] {
	const elements = buildTitleBand(ctx, ctx.t('agendaTitle'));
	const rowStart = 1780000;
	const rowStep = 1150000;
	for (let i = 0; i < 4; i++) {
		const y = rowStart + i * rowStep;
		elements.push(
			templateText(ctx, { x: MARGIN, y, w: 900000, h: 900000 }, `0${i + 1}`, {
				name: `Agenda Number ${i + 1}`,
				fontSize: 28,
				colorKey: 'accent1',
				bold: true,
				align: 'left',
				vAlign: 'middle',
			}),
			templateText(
				ctx,
				{ x: MARGIN + 1000000, y, w: CONTENT_W - 1000000, h: 900000 },
				`${ctx.t('agendaItem')} ${i + 1}`,
				{
					name: `Agenda Item ${i + 1}`,
					fontSize: 20,
					colorKey: 'tx1',
					align: 'left',
					vAlign: 'middle',
				},
			),
		);
		if (i < 3) {
			elements.push(
				templateShape(
					ctx,
					{ x: MARGIN, y: y + 990000, w: CONTENT_W, h: 25400 },
					{ name: `Agenda Divider ${i + 1}`, fillKey: 'bg2' },
				),
			);
		}
	}
	return elements;
}

/** Two content: title band and two side-by-side content panels. */
export function buildTwoContentSlide(ctx: SlideTemplateBuildContext): PptxElement[] {
	const panelY = 1720000;
	const panelH = 4400000;
	return [
		...buildTitleBand(ctx, ctx.t('slideTitle')),
		templateShape(
			ctx,
			{ x: MARGIN, y: panelY, w: HALF_PANEL_W, h: panelH },
			{
				name: 'Left Content',
				fillKey: 'bg2',
				shapeType: 'roundRect',
				text: ctx.t('leftContent'),
				textOptions: { fontSize: 16, colorKey: 'tx2' },
			},
		),
		templateShape(
			ctx,
			{ x: RIGHT_PANEL_X, y: panelY, w: HALF_PANEL_W, h: panelH },
			{
				name: 'Right Content',
				fillKey: 'bg2',
				shapeType: 'roundRect',
				text: ctx.t('rightContent'),
				textOptions: { fontSize: 16, colorKey: 'tx2' },
			},
		),
	];
}

/** Comparison: two headed columns with accent headers. */
export function buildComparisonSlide(ctx: SlideTemplateBuildContext): PptxElement[] {
	const headerY = 1720000;
	const headerH = 700000;
	const bodyY = 2540000;
	const bodyH = 3580000;
	const column = (x: number, headKey: string, headFill: string, side: string): PptxElement[] => [
		templateShape(
			ctx,
			{ x, y: headerY, w: HALF_PANEL_W, h: headerH },
			{
				name: `${side} Header`,
				fillKey: headFill,
				shapeType: 'roundRect',
				text: ctx.t(headKey),
				textOptions: { fontSize: 18, colorKey: 'lt1', bold: true },
			},
		),
		templateShape(
			ctx,
			{ x, y: bodyY, w: HALF_PANEL_W, h: bodyH },
			{
				name: `${side} Body`,
				fillKey: 'bg2',
				shapeType: 'roundRect',
				text: ctx.t(side === 'Left' ? 'leftContent' : 'rightContent'),
				textOptions: { fontSize: 16, colorKey: 'tx2' },
			},
		),
	];
	return [
		...buildTitleBand(ctx, ctx.t('slideTitle')),
		...column(MARGIN, 'optionA', 'accent1', 'Left'),
		...column(RIGHT_PANEL_X, 'optionB', 'accent2', 'Right'),
	];
}

/** Quote: oversized quote mark, centred quote, attribution. */
export function buildQuoteSlide(ctx: SlideTemplateBuildContext): PptxElement[] {
	return [
		templateText(ctx, { x: MARGIN, y: 1100000, w: 1600000, h: 1500000 }, '“', {
			name: 'Quote Mark',
			fontSize: 96,
			colorKey: 'accent1',
			bold: true,
			align: 'left',
			vAlign: 'top',
		}),
		templateText(ctx, { x: 1300000, y: 2300000, w: 9592000, h: 1800000 }, ctx.t('quoteText'), {
			name: 'Quote',
			fontSize: 28,
			colorKey: 'tx1',
			italic: true,
			align: 'center',
			vAlign: 'middle',
			lineSpacing: 1.3,
		}),
		templateText(
			ctx,
			{ x: 1300000, y: 4350000, w: 9592000, h: 600000 },
			ctx.t('quoteAttribution'),
			{ name: 'Attribution', fontSize: 16, colorKey: 'tx2', align: 'center', vAlign: 'top' },
		),
	];
}

/** Timeline: horizontal rule with four milestone markers. */
export function buildTimelineSlide(ctx: SlideTemplateBuildContext): PptxElement[] {
	const elements = buildTitleBand(ctx, ctx.t('slideTitle'));
	const lineY = 3450000;
	elements.push(
		templateShape(
			ctx,
			{ x: MARGIN + 200000, y: lineY, w: CONTENT_W - 400000, h: 50000 },
			{ name: 'Timeline Rule', fillKey: 'bg2' },
		),
	);
	const dot = 350000;
	for (let i = 0; i < 4; i++) {
		const cx = MARGIN + 200000 + ((CONTENT_W - 400000) * (2 * i + 1)) / 8;
		elements.push(
			templateShape(
				ctx,
				{ x: cx - dot / 2, y: lineY + 25000 - dot / 2, w: dot, h: dot },
				{ name: `Milestone Marker ${i + 1}`, fillKey: 'accent1', shapeType: 'ellipse' },
			),
			templateText(
				ctx,
				{ x: cx - 900000, y: 2650000, w: 1800000, h: 500000 },
				`${ctx.t('milestoneStep')} ${i + 1}`,
				{
					name: `Milestone Label ${i + 1}`,
					fontSize: 14,
					colorKey: 'accent1',
					bold: true,
					align: 'center',
					vAlign: 'bottom',
				},
			),
			templateText(
				ctx,
				{ x: cx - 900000, y: 3850000, w: 1800000, h: 800000 },
				ctx.t('milestoneCaption'),
				{
					name: `Milestone Caption ${i + 1}`,
					fontSize: 14,
					colorKey: 'tx1',
					align: 'center',
					vAlign: 'top',
				},
			),
		);
	}
	return elements;
}

/** Key metrics: three stat tiles with a big accent value and a caption. */
export function buildKeyMetricsSlide(ctx: SlideTemplateBuildContext): PptxElement[] {
	const elements = buildTitleBand(ctx, ctx.t('slideTitle'));
	const tileW = (CONTENT_W - 2 * PANEL_GAP) / 3;
	const tileY = 1950000;
	const tileH = 3200000;
	const values = ['42%', '3.5x', '120+'];
	for (let i = 0; i < 3; i++) {
		const x = MARGIN + i * (tileW + PANEL_GAP);
		elements.push(
			templateShape(
				ctx,
				{ x, y: tileY, w: tileW, h: tileH },
				{ name: `Metric Tile ${i + 1}`, fillKey: 'bg2', shapeType: 'roundRect' },
			),
			templateText(
				ctx,
				{ x: x + 200000, y: tileY + 650000, w: tileW - 400000, h: 1200000 },
				values[i] ?? '',
				{
					name: `Metric Value ${i + 1}`,
					fontSize: 44,
					colorKey: 'accent1',
					bold: true,
					align: 'center',
					vAlign: 'middle',
				},
			),
			templateText(
				ctx,
				{ x: x + 200000, y: tileY + 2000000, w: tileW - 400000, h: 900000 },
				ctx.t('metricCaption'),
				{
					name: `Metric Caption ${i + 1}`,
					fontSize: 14,
					colorKey: 'tx2',
					align: 'center',
					vAlign: 'top',
				},
			),
		);
	}
	return elements;
}

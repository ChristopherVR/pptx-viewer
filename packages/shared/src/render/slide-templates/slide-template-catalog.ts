/**
 * slide-template-catalog.ts: the catalogue of pre-designed starter slides
 * insertable from every binding's New Slide flow. Single source of truth for
 * the gallery list AND for what insertion produces, so gallery previews
 * (live-rendered through each binding's real renderer, mirroring the
 * SmartArt preset pattern) always show exactly what will be inserted.
 */

import type { PptxSlide } from 'pptx-viewer-core';

import {
	buildBlankSlide,
	buildClosingSlide,
	buildSectionHeaderSlide,
	buildTitleAndContentSlide,
	buildTitleOnlySlide,
	buildTitleSlide,
} from './slide-template-builders-basic';
import {
	buildAgendaSlide,
	buildComparisonSlide,
	buildKeyMetricsSlide,
	buildQuoteSlide,
	buildTimelineSlide,
	buildTwoContentSlide,
} from './slide-template-builders-content';
import { createTemplateContext, resolveSchemeColor } from './slide-template-helpers';
import type {
	SlideTemplateBuildContext,
	SlideTemplateBuildOptions,
	SlideTemplateBuildResult,
	SlideTemplateId,
	SlideTemplateSpec,
} from './slide-template-types';

type TemplateBuilder = (ctx: SlideTemplateBuildContext) => SlideTemplateBuildResult['elements'];

const BUILDERS: Record<SlideTemplateId, TemplateBuilder> = {
	title: buildTitleSlide,
	titleAndContent: buildTitleAndContentSlide,
	sectionHeader: buildSectionHeaderSlide,
	agenda: buildAgendaSlide,
	twoContent: buildTwoContentSlide,
	comparison: buildComparisonSlide,
	quote: buildQuoteSlide,
	timeline: buildTimelineSlide,
	keyMetrics: buildKeyMetricsSlide,
	titleOnly: buildTitleOnlySlide,
	blank: buildBlankSlide,
	closing: buildClosingSlide,
};

function spec(id: SlideTemplateId): SlideTemplateSpec {
	return {
		id,
		nameKey: `pptx.slideTemplates.${id}.name`,
		descriptionKey: `pptx.slideTemplates.${id}.description`,
	};
}

/** Ordered gallery catalogue: one entry per built-in slide template. */
export const SLIDE_TEMPLATES: readonly SlideTemplateSpec[] = [
	spec('title'),
	spec('titleAndContent'),
	spec('sectionHeader'),
	spec('agenda'),
	spec('twoContent'),
	spec('comparison'),
	spec('quote'),
	spec('timeline'),
	spec('keyMetrics'),
	spec('titleOnly'),
	spec('blank'),
	spec('closing'),
];

/** All template ids in gallery order. */
export const SLIDE_TEMPLATE_IDS: readonly SlideTemplateId[] = SLIDE_TEMPLATES.map((s) => s.id);

/**
 * Build the theme-aware content a template inserts.
 *
 * Pass the deck's `themeColorMap` (and canvas size) in `options` so the
 * inserted slide inherits the deck look; colours also carry `a:schemeClr`
 * round-trip nodes so a save re-emits theme references, not literal RGB.
 */
export function buildSlideTemplateContent(
	id: SlideTemplateId,
	options: SlideTemplateBuildOptions = {},
): SlideTemplateBuildResult {
	const ctx = createTemplateContext(options);
	return {
		elements: BUILDERS[id](ctx),
		backgroundColor: resolveSchemeColor(ctx.scheme, 'bg1'),
	};
}

/**
 * Build a complete draft `PptxSlide` for a template, ready for a binding's
 * history-integrated insert path. The caller provides identity (`id`) and
 * numbering; elements are fully positioned for the target canvas.
 */
export function buildSlideTemplateSlide(
	templateId: SlideTemplateId,
	slideId: string,
	slideNumber: number,
	options: SlideTemplateBuildOptions = {},
): PptxSlide {
	const content = buildSlideTemplateContent(templateId, options);
	return {
		id: slideId,
		rId: '',
		slideNumber,
		elements: content.elements,
		...(content.backgroundColor ? { backgroundColor: content.backgroundColor } : {}),
	};
}

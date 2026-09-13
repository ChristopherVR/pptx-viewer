import type { TextSegment } from 'pptx-viewer-core';
import type { InlineListRun, ParagraphRun } from 'pptx-viewer-shared';
import {
	segmentStyleToCss,
	resolveAutoFitFontScale,
	withInlineListDecorationDefaults,
	applyUnderlineVariant,
	nestedTextDecorationStyle,
} from 'pptx-viewer-shared';
import React from 'react';

import { renderParagraphRun } from './text-segment-render';
import type { RunRenderContext } from './text-segment-render';

/** Add session tokens to the existing rich run renderer, without another style engine. */
export function renderSeededListRun(
	seed: InlineListRun,
	runs: readonly ParagraphRun[],
	segments: readonly TextSegment[],
	context: RunRenderContext,
): React.ReactNode {
	const sourceRun = runs.find((candidate) => candidate.segmentIndex === seed.segmentIndex);
	const segment = sourceRun ? segments[seed.segmentIndex] : { text: seed.text, style: seed.style };
	const resolvedSegment = {
		...segment,
		style: withInlineListDecorationDefaults(segment.style, context.element.textStyle),
	};
	const decorationCss = segmentStyleToCss(
		resolvedSegment,
		resolveAutoFitFontScale(context.element.textStyle),
	);
	applyUnderlineVariant(decorationCss, resolvedSegment);
	const run = sourceRun
		? { ...sourceRun, style: { ...sourceRun.style, ...nestedTextDecorationStyle(decorationCss) } }
		: {
				text: seed.text,
				style: decorationCss,
				segmentIndex: seed.segmentIndex,
			};
	const rendered = renderParagraphRun(run, resolvedSegment, context);
	if (!React.isValidElement<React.HTMLAttributes<HTMLElement>>(rendered)) {
		return rendered;
	}
	return React.cloneElement(rendered, {
		'data-pptx-list-run': seed.token,
		...(seed.text === '' ? { children: <br /> } : {}),
	} as React.HTMLAttributes<HTMLElement>);
}

import type { TextStyle, BulletInfo } from 'pptx-viewer-core';
import { buildTextBuildSpec, textBuildSpanStyle } from 'pptx-viewer-shared';
import React from 'react';

import { TEXT_BUILD_ID_SEP } from './animation-timeline';
import type { ElementAnimationState } from './animation-timeline';

/**
 * A paragraph entry linking a text segment to its global index
 * in the original textSegments array (for highlights).
 */
export interface ParagraphEntry {
	segment: {
		text: string;
		style: TextStyle;
		bulletInfo?: BulletInfo;
		fieldType?: string;
		equationXml?: Record<string, unknown>;
		equationNumber?: string;
		rubyText?: string;
		rubyAlignment?: string;
		rubyFontSize?: number;
		rubyStyle?: TextStyle;
	};
	globalIndex: number;
}

/**
 * Render one piece of a split paragraph: the caller re-renders `entry`'s
 * segment with `text` substituted, so the piece keeps the run's font, size,
 * colour, decoration and hyperlink.
 */
export type RenderTextBuildPiece = (entry: ParagraphEntry, text: string) => React.ReactNode;

/**
 * Build inline style for a sub-element animation state (visibility + CSS animation).
 */
export function buildAnimStyle(
	state: ElementAnimationState | undefined,
): React.CSSProperties | undefined {
	if (!state) {
		return undefined;
	}
	const style: React.CSSProperties = {};
	if (state.visible === false) {
		style.visibility = 'hidden';
	}
	if (state.cssAnimation) {
		style.animation = state.cssAnimation;
	}
	return Object.keys(style).length > 0 ? style : undefined;
}

/**
 * Wrap rendered paragraph segments with animation-aware spans when
 * sub-element animation states are present.
 *
 * If no sub-element states exist for this element, returns the rendered
 * segments unchanged (zero overhead in the default case).
 *
 * Word / character builds delegate the split to `pptx-viewer-shared`'s
 * `buildTextBuildSpec`, which carries each piece's ORIGINATING RUN through.
 * React used to concatenate the paragraph into one plain string and emit bare
 * spans, so a by-letter title lost its font, size, colour and weight for the
 * whole show; the other four bindings already rendered through the shared spec.
 */
export function wrapWithTextBuildAnimation(
	elementId: string,
	paraIndex: number,
	renderedSegments: React.ReactNode[],
	paraSegments: ReadonlyArray<ParagraphEntry>,
	subElementAnimStates: ReadonlyMap<string, ElementAnimationState> | undefined,
	renderPiece?: RenderTextBuildPiece,
): React.ReactNode {
	if (!subElementAnimStates || subElementAnimStates.size === 0) {
		return renderedSegments;
	}

	// ── Paragraph-level build ──
	const paraKey = `${elementId}${TEXT_BUILD_ID_SEP}p${paraIndex}`;
	const paraState = subElementAnimStates.get(paraKey);
	if (paraState) {
		const style = buildAnimStyle(paraState);
		return (
			<span key={paraKey} data-anim-id={paraKey} style={{ display: 'inline', ...style }}>
				{renderedSegments}
			</span>
		);
	}

	const spec = buildTextBuildSpec<ParagraphEntry>(
		elementId,
		paraIndex,
		paraSegments.map((entry) => ({ text: entry.segment.text, style: entry })),
		subElementAnimStates,
	);
	if (!spec?.spans) {
		return renderedSegments;
	}

	return spec.spans.map((span, index) => {
		const content = span.style && renderPiece ? renderPiece(span.style, span.text) : span.text;
		if (!span.animId) {
			// Whitespace between words: emitted verbatim, never animated.
			return <React.Fragment key={`ws-${index}`}>{content}</React.Fragment>;
		}
		return (
			<span
				key={span.animId}
				data-anim-id={span.animId}
				style={textBuildSpanStyle(span) as React.CSSProperties}
			>
				{content}
			</span>
		);
	});
}

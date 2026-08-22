import type { ParagraphRun } from 'pptx-viewer-shared';
import React from 'react';

/**
 * Wrap a run's rendered span with its `a:reflection` mirrored sibling, or
 * return the span unchanged when the run carries no reflection.
 *
 * Shared attaches a cross-browser mirrored-sibling wrapper style to
 * `run.reflection` (`getTextReflectionWrapperStyle`, the text counterpart of a
 * shape/picture's `ShapeEffectOverlay` reflection) instead of the old
 * Chromium/WebKit-only `-webkit-box-reflect`, which Firefox never rendered at
 * all. The mirror repaints the PLAIN content (not the ruby annotation) inside
 * its own positioned wrapper; `position: relative` + `inline-block` on that
 * wrapper is what gives the mirror's `top: calc(100% + ...)` something to
 * measure against for an inline run.
 *
 * Split out of `text-segment-render.tsx` to keep that module's per-run
 * resolution focused and under the repo's file-size guideline.
 */
export function wrapWithTextReflection(
	run: ParagraphRun,
	key: string,
	spanNode: React.ReactNode,
	spanStyle: React.CSSProperties,
	baseContent: React.ReactNode,
): React.ReactNode {
	if (!run.reflection) {
		return spanNode;
	}
	return (
		<span key={`${key}-reflwrap`} style={{ position: 'relative', display: 'inline-block' }}>
			{spanNode}
			<span
				aria-hidden='true'
				className='pptx-react-text-reflection'
				style={run.reflection as React.CSSProperties}
			>
				<span style={spanStyle}>{baseContent}</span>
			</span>
		</span>
	);
}

/**
 * AiFocusHighlightOverlay: draws animated rings around the element(s) the AI
 * assistant is focused on, rendered INSIDE the (already-scaled) slide stage so
 * element canvas coordinates map 1:1. Two variants share the same overlay:
 *   - `pick`  : a persistent, subtle ring for an element the user handed to the
 *     assistant in pick mode (with a brief entry pulse).
 *   - `active`: a livelier pulsing ring for the element a running tool is
 *     touching right now ("the AI is looking at / working on this").
 *
 * Purely presentational: it reads element bounds from the active slide and the
 * highlight list computed by {@link useAiPanelController}. Only highlights on
 * the active slide are drawn.
 */
import type { PptxElement } from 'pptx-viewer-core';

import type { AiCanvasHighlight } from '../../hooks/ai/useAiPanelController';

export interface AiFocusHighlightOverlayProps {
	highlights: AiCanvasHighlight[];
	/** Elements of the currently visible slide, for bounds lookup. */
	elements: PptxElement[];
	activeSlideIndex: number;
}

/** Keyframes + colour-tween rule injected once with the overlay. */
const OVERLAY_CSS = `
@keyframes pptx-ai-ring-pulse {
	0% { box-shadow: 0 0 0 0 rgba(59,130,246,0.55), 0 0 0 0 rgba(59,130,246,0.35); }
	70% { box-shadow: 0 0 0 6px rgba(59,130,246,0), 0 0 14px 4px rgba(59,130,246,0.28); }
	100% { box-shadow: 0 0 0 0 rgba(59,130,246,0), 0 0 10px 2px rgba(59,130,246,0.22); }
}
@keyframes pptx-ai-ring-in {
	0% { opacity: 0; transform: scale(1.04); }
	100% { opacity: 1; transform: scale(1); }
}
/* While the AI is active, tween colour changes on slide elements so an edit
   fades from its old value to the new one instead of snapping. */
[data-pptx-ai-active='true'] [data-element-id],
[data-pptx-ai-active='true'] [data-element-id] * {
	transition: color 0.5s ease, fill 0.5s ease, stroke 0.5s ease, background-color 0.5s ease,
		border-color 0.5s ease;
}
`;

export function AiFocusHighlightOverlay({
	highlights,
	elements,
	activeSlideIndex,
}: AiFocusHighlightOverlayProps) {
	if (highlights.length === 0) {
		return null;
	}
	const byId = new Map(elements.map((el) => [el.id, el]));

	return (
		<>
			<style>{OVERLAY_CSS}</style>
			{highlights.map((hl) => {
				if (hl.slideIndex !== activeSlideIndex) {
					return null;
				}
				const el = byId.get(hl.elementId);
				if (!el) {
					return null;
				}
				const active = hl.variant === 'active';
				return (
					<div
						key={`ai-hl-${hl.variant}-${hl.elementId}`}
						data-testid={`ai-focus-highlight-${hl.elementId}`}
						data-ai-highlight={hl.variant}
						data-export-ignore='true'
						className='absolute pointer-events-none rounded-[3px]'
						style={{
							left: el.x - 3,
							top: el.y - 3,
							width: el.width + 6,
							height: el.height + 6,
							zIndex: 9998,
							border: active ? '2px solid rgba(59,130,246,0.9)' : '2px solid rgba(59,130,246,0.55)',
							animation: active
								? 'pptx-ai-ring-in 0.18s ease-out, pptx-ai-ring-pulse 1s ease-out infinite'
								: 'pptx-ai-ring-in 0.9s ease-out',
							boxShadow: active ? undefined : '0 0 10px 2px rgba(59,130,246,0.18)',
						}}
					/>
				);
			})}
		</>
	);
}

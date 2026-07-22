/**
 * AiChangeOverlay: plays the "watch the AI edit land" animation. For each
 * element the assistant just changed on the visible slide it draws a ghost rect
 * that, on the next frame, flips from its `start` to `end` state so the browser
 * transitions between them: added elements fade+scale in, removed fade+scale
 * out, moved/resized glide old->new, all under a glow-pulse. Rendered INSIDE the
 * scaled slide stage, so the change bounds (slide CSS pixels) map 1:1.
 *
 * Purely presentational: the batch (with per-element from/to bounds + resolved
 * config) comes from the shared {@link AiChangeAnimator} via the panel
 * controller. The ghosts carry their own geometry, so no element lookup needed.
 */
import type { AiChangeBatch } from 'pptx-viewer-shared/ai';
import { aiChangeAnimationCss, changeGhostStyle } from 'pptx-viewer-shared/ai';
import { useEffect, useState } from 'react';

export interface AiChangeOverlayProps {
	batch: AiChangeBatch | null;
	activeSlideIndex: number;
}

export function AiChangeOverlay({ batch, activeSlideIndex }: AiChangeOverlayProps) {
	const [phase, setPhase] = useState<'start' | 'end'>('start');
	const nonce = batch?.nonce ?? 0;

	useEffect(() => {
		if (!batch) {
			return;
		}
		setPhase('start');
		// Two frames: let the browser paint the `start` state before flipping to
		// `end`, so the CSS transition actually runs instead of snapping.
		let inner = 0;
		const outer = requestAnimationFrame(() => {
			inner = requestAnimationFrame(() => setPhase('end'));
		});
		return () => {
			cancelAnimationFrame(outer);
			cancelAnimationFrame(inner);
		};
	}, [nonce, batch]);

	if (!batch) {
		return null;
	}
	const changes = batch.changes.filter((c) => c.slideIndex === activeSlideIndex);
	if (changes.length === 0) {
		return null;
	}

	return (
		<>
			<style>{aiChangeAnimationCss(batch.config)}</style>
			{changes.map((change) => (
				<div
					key={`ai-change-${change.elementId}-${nonce}`}
					data-testid={`ai-change-${change.elementId}`}
					data-ai-change={change.kind}
					data-export-ignore='true'
					style={changeGhostStyle(change, phase, batch.config)}
				/>
			))}
		</>
	);
}

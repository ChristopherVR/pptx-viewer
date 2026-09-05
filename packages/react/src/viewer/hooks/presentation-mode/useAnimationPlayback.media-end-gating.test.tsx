// @vitest-environment happy-dom
/**
 * G13: an `onStopAudio`-gated effect (`p:cond/@evt="onStopAudio"` targeting a
 * SPECIFIC audio time node) should start from the REAL `<audio>` element's
 * `ended` event, not only the estimated `delayMs` baked into its cssAnimation
 * at build time. Mirrors the shared `animation-playback-engine` coverage;
 * React consumes that same shared engine directly (see
 * `useAnimationPlayback.ts`'s `mediaTimeNodeElementIdsRef`).
 */
import type { PptxNativeAnimation, PptxSlide } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useAnimationPlayback } from './useAnimationPlayback';
import type { UseAnimationPlaybackResult } from './useAnimationPlayback';

const mediaAnim = {
	targetId: 'audio1',
	nodeId: 5,
	kind: 'media',
	presetClass: 'entr',
	trigger: 'onClick',
} as unknown as PptxNativeAnimation;

const dependentAnim = {
	targetId: 'el1',
	presetClass: 'entr',
	trigger: 'afterPrevious',
	startConditions: [{ event: 'onStopAudio', delay: 0, targetTimeNodeId: 5 }],
} as unknown as PptxNativeAnimation;

const slide = {
	id: 'slide-1',
	elements: [
		{ type: 'media', id: 'audio1', x: 0, y: 0, width: 10, height: 10 },
		{ type: 'shape', id: 'el1', x: 0, y: 0, width: 100, height: 100 },
	],
	nativeAnimations: [mediaAnim, dependentAnim],
} as unknown as PptxSlide;

function Harness(props: { onResult: (result: UseAnimationPlaybackResult) => void }) {
	const result = useAnimationPlayback({ slides: [slide] });
	props.onResult(result);
	return (
		<div>
			<div data-element-id='audio1'>
				<audio />
			</div>
			<div data-element-id='el1' />
		</div>
	);
}

describe('useAnimationPlayback onStopAudio real-media-ended gating', () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.append(container);
		root = createRoot(container);
	});

	afterEach(async () => {
		await act(async () => root.unmount());
		container.remove();
	});

	it('re-applies the gated step with delay=0 when the real audio element fires ended', async () => {
		let latest: UseAnimationPlaybackResult | undefined;
		await act(async () => {
			root.render(<Harness onResult={(result) => (latest = result)} />);
		});
		expect(latest).toBeDefined();

		await act(async () => {
			latest!.seedSlideAnimations(0);
		});
		await act(async () => {
			latest!.playNextAnimationGroup();
		});

		const before = latest!.presentationElementStates.get('el1')?.cssAnimation;
		expect(before).toBeTypeOf('string');

		const audio = container.querySelector('audio');
		expect(audio).not.toBeNull();
		await act(async () => {
			audio!.dispatchEvent(new Event('ended'));
		});

		expect(latest!.presentationElementStates.get('el1')?.cssAnimation).toContain(' 0ms ');
	});
});

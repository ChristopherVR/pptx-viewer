// @vitest-environment happy-dom

import type { PptxNativeAnimation, PptxSlide } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useAnimationPlayback } from './useAnimationPlayback';
import type { UseAnimationPlaybackInput, UseAnimationPlaybackResult } from './useAnimationPlayback';

/**
 * Confirms this hook's `fromSlide` call site actually forwards `canvasSize` /
 * `themeColorMap` (the geometry + theme render context) rather than dropping
 * them: without either, a cross-axis `p:anim` formula like Grow And Turn's
 * `-#ppt_w/2` fly-in falls back to canned timing (see the shared-level test in
 * `presentation-animation-controller.test.ts`); with them, the resolved
 * translate delta shows up in the generated keyframes CSS.
 */
function growAndTurnSlide(): PptxSlide {
	return {
		id: 'slide-1',
		elements: [{ type: 'shape', id: 'a', x: 200, y: 150, width: 200, height: 100 }],
		nativeAnimations: [
			{
				attributeAnimations: [
					{ attrName: 'ppt_x', from: '(-#ppt_w/2)', keyframes: [], to: '(#ppt_x)' },
				],
				durationMs: 600,
				presetClass: 'entr',
				targetId: 'a',
				trigger: 'onClick',
			} as unknown as PptxNativeAnimation,
		],
	} as unknown as PptxSlide;
}

function Harness(props: {
	onResult: (result: UseAnimationPlaybackResult) => void;
	input: Omit<UseAnimationPlaybackInput, 'slides'>;
}) {
	const result = useAnimationPlayback({ slides: [growAndTurnSlide()], ...props.input });
	props.onResult(result);
	return <div />;
}

describe('useAnimationPlayback geometry/theme render context wiring', () => {
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

	it('resolves the cross-axis fly-in formula when canvasSize is passed through', async () => {
		let latest: UseAnimationPlaybackResult | undefined;
		await act(async () => {
			root.render(
				<Harness
					input={{ canvasSize: { height: 720, width: 960 } }}
					onResult={(result) => (latest = result)}
				/>,
			);
		});
		await act(async () => latest!.seedSlideAnimations(0));
		// centre x = (200 + 200/2) / 960 = 0.3125; from = -100/960 = -0.104167;
		// delta = -0.104167 - 0.3125 = -0.416667 -> formatted to 4dp.
		expect(latest!.presentationKeyframesCss).toContain('-0.4167');
	});

	it('falls back to canned timing when canvasSize is not passed', async () => {
		let latest: UseAnimationPlaybackResult | undefined;
		await act(async () => {
			root.render(<Harness input={{}} onResult={(result) => (latest = result)} />);
		});
		await act(async () => latest!.seedSlideAnimations(0));
		expect(latest!.presentationKeyframesCss).not.toContain('-0.4167');
	});
});

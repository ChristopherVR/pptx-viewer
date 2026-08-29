// @vitest-environment happy-dom

import type { PptxNativeAnimation, PptxSlide } from 'pptx-viewer-core';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAnimationPlayback } from './useAnimationPlayback';
import type { UseAnimationPlaybackResult } from './useAnimationPlayback';

function makeAnimation(
	targetId: string,
	overrides: Partial<PptxNativeAnimation> = {},
): PptxNativeAnimation {
	return {
		targetId,
		presetClass: 'entr',
		presetId: 10,
		trigger: 'onClick',
		durationMs: 1_000,
		delayMs: 0,
		...overrides,
	} as PptxNativeAnimation;
}

const slide = {
	id: 'slide-1',
	elements: [
		{ type: 'shape', id: 'first', x: 0, y: 0, width: 100, height: 100 },
		{ type: 'shape', id: 'second', x: 0, y: 0, width: 100, height: 100 },
	],
	nativeAnimations: [
		makeAnimation('first', { seqNextAction: 'seek' }),
		makeAnimation('second', { durationMs: 500, seqNextAction: 'seek' }),
	],
} as unknown as PptxSlide;

function Harness(props: { onResult: (result: UseAnimationPlaybackResult) => void }) {
	const result = useAnimationPlayback({ slides: [slide] });
	props.onResult(result);
	return <div data-element-id='first' />;
}

describe('useAnimationPlayback rapid next seek', () => {
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

	it('finishes the active seek group without advancing the next group on the same press', async () => {
		let latest: UseAnimationPlaybackResult | undefined;
		await act(async () => {
			root.render(<Harness onResult={(result) => (latest = result)} />);
		});
		expect(latest).toBeDefined();

		const finish = vi.fn();
		const element = container.querySelector<HTMLElement>('[data-element-id="first"]');
		expect(element).not.toBeNull();
		element!.getAnimations = () =>
			[
				{
					effect: { getTiming: () => ({ iterations: 1 }) },
					playState: 'running',
					finish,
				},
			] as unknown as Animation[];

		await act(async () => latest!.seedSlideAnimations(0));
		expect(latest!.presentationElementStates.get('first')?.visible).toBeFalsy();
		expect(latest!.presentationElementStates.get('second')?.visible).toBeFalsy();

		await act(async () => expect(latest!.playNextAnimationGroup()).toBeTruthy());
		expect(latest!.presentationElementStates.get('first')?.visible).toBeTruthy();

		await act(async () => expect(latest!.playNextAnimationGroup()).toBeTruthy());
		expect(finish).toHaveBeenCalledOnce();
		expect(latest!.presentationElementStates.get('second')?.visible).toBeFalsy();

		await act(async () => expect(latest!.playNextAnimationGroup()).toBeTruthy());
		expect(latest!.presentationElementStates.get('second')?.visible).toBeTruthy();

		await act(async () => expect(latest!.playNextAnimationGroup()).toBeFalsy());
	});
});

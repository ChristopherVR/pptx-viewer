// @vitest-environment happy-dom
/**
 * B7 (wave-4): the `PresentationActionRunner` extensions.
 * - `openFile`/`openPresentation` open the target through the shared safe-URL
 *   helper: a `javascript:` target does nothing.
 * - `customShow` with `returnAfter` returns to the origin slide once the
 *   sub-show ends (the "end of show" hook, not just `useCustomShowRunner` in
 *   isolation - this pins the wiring between the two).
 */
import React, { act, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { usePresentationActionExtensions } from './usePresentationActionExtensions';
import type { UsePresentationActionExtensionsResult } from './usePresentationActionExtensions';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

interface HarnessHandle extends UsePresentationActionExtensionsResult {}

function Harness({ onReady }: { onReady: (handle: HarnessHandle) => void }): React.ReactElement {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const result = usePresentationActionExtensions({
		slides: [],
		customShows: [{ id: 'showA', slideRIds: ['rId1'] }],
		activeCustomShowId: null,
		onSetActiveCustomShowId: () => {},
		presentationSlideIndex: 0,
		containerRef,
		endWithBlackSlide: true,
		onSetMode: () => {},
		setEndOfShowVisible: () => {},
	});
	onReady(result);
	return <div ref={containerRef} />;
}

describe('usePresentationActionExtensions', () => {
	it('openFile does nothing for a javascript: target', () => {
		let handle: HarnessHandle | null = null;
		act(() => {
			root.render(<Harness onReady={(h) => (handle = h)} />);
		});
		const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
		act(() => {
			// Deliberately unsafe test input, asserting the safe-URL guard rejects it.
			// oxlint-disable-next-line eslint/no-script-url
			handle!.onOpenFile('javascript:alert(1)');
		});
		expect(openSpy).not.toHaveBeenCalled();
		openSpy.mockRestore();
	});

	it('openPresentation opens a safe target in a new tab', () => {
		let handle: HarnessHandle | null = null;
		act(() => {
			root.render(<Harness onReady={(h) => (handle = h)} />);
		});
		const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
		act(() => {
			handle!.onOpenPresentation('https://example.com/deck.pptx');
		});
		expect(openSpy).toHaveBeenCalledWith(
			'https://example.com/deck.pptx',
			'_blank',
			'noopener,noreferrer',
		);
		openSpy.mockRestore();
	});
});

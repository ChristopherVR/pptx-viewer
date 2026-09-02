import type { PptxSlide } from 'pptx-viewer-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildPresentationActionRunner } from './presentation-action-runner';
import type { PresentationActionRunnerDeps } from './presentation-action-runner';

function harness(overrides: Partial<PresentationActionRunnerDeps> = {}) {
	const stageRoot = document.createElement('div');
	document.body.appendChild(stageRoot);
	const deps: PresentationActionRunnerDeps = {
		goToSlide: vi.fn(),
		next: vi.fn(),
		prev: vi.fn(),
		exitPresentation: vi.fn(),
		getStageRoot: () => stageRoot,
		getPreviousPresentedSlide: () => null,
		getCurrentSlide: () => undefined,
		customShowRunner: { customShow: vi.fn(), dispose: vi.fn() },
		...overrides,
	};
	return { runner: buildPresentationActionRunner(deps), deps, stageRoot };
}

describe('vanilla presentation action runner (B7)', () => {
	afterEach(() => {
		document.body.replaceChildren();
		vi.restoreAllMocks();
	});

	it('lastViewed is a no-op with no previous slide', () => {
		const { runner, deps } = harness({ getPreviousPresentedSlide: () => null });
		runner.lastViewed?.();
		expect(deps.goToSlide).not.toHaveBeenCalled();
	});

	it('lastViewed navigates to the tracked previous slide', () => {
		const { runner, deps } = harness({ getPreviousPresentedSlide: () => 2 });
		runner.lastViewed?.();
		expect(deps.goToSlide).toHaveBeenCalledWith(2);
	});

	it('customShow delegates to the custom-show runner', () => {
		const { runner, deps } = harness();
		runner.customShow?.('sh1', true);
		expect(deps.customShowRunner.customShow).toHaveBeenCalledWith('sh1', true);
	});

	it('openFile opens a safe target in a new tab', () => {
		const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
		const { runner } = harness();
		runner.openFile?.('https://example.com/deck.pptx');
		expect(openSpy).toHaveBeenCalledWith(
			'https://example.com/deck.pptx',
			'_blank',
			expect.stringContaining('noopener'),
		);
	});

	it('openFile with a javascript: target does nothing', () => {
		const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
		const { runner } = harness();
		// eslint-disable-next-line no-script-url -- security test fixture: verifies the scheme is rejected.
		runner.openFile?.('javascript:alert(1)');
		expect(openSpy).not.toHaveBeenCalled();
	});

	it('openPresentation with a javascript: target does nothing', () => {
		const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
		const { runner } = harness();
		// eslint-disable-next-line no-script-url -- security test fixture: verifies the scheme is rejected.
		runner.openPresentation?.('javascript:alert(1)');
		expect(openSpy).not.toHaveBeenCalled();
	});

	it('playMedia toggles playback of the clicked element media', () => {
		const { runner, stageRoot } = harness();
		const container = document.createElement('div');
		container.dataset.elementId = 'media-1';
		const video = document.createElement('video');
		Object.defineProperty(video, 'paused', { value: true, configurable: true });
		const play = vi.fn().mockResolvedValue(undefined);
		video.play = play;
		container.appendChild(video);
		stageRoot.appendChild(container);

		runner.playMedia?.('media-1');

		expect(play).toHaveBeenCalledOnce();
	});

	it('playMedia is a no-op for an unknown element id', () => {
		const { runner } = harness();
		expect(() => runner.playMedia?.('missing')).not.toThrow();
	});

	it('playMedia is a no-op with no element id', () => {
		const { runner, deps } = harness();
		runner.playMedia?.(undefined);
		expect(deps.goToSlide).not.toHaveBeenCalled();
	});

	it("oleVerb opens the clicked OLE object's recovered embedding", () => {
		const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
		const slide = {
			id: 's1',
			elements: [{ id: 'ole1', type: 'ole', oleEmbeddedData: 'blob:http://localhost/ole-payload' }],
		} as unknown as PptxSlide;
		const { runner } = harness({ getCurrentSlide: () => slide });
		runner.oleVerb?.(-1, 'ole1');
		expect(openSpy).toHaveBeenCalledWith('blob:http://localhost/ole-payload', '_blank');
	});

	it('oleVerb is a no-op without a slide, an element, or a recovered embedding', () => {
		const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
		const slide = { id: 's1', elements: [{ id: 'ole1', type: 'ole' }] } as unknown as PptxSlide;
		const { runner } = harness({ getCurrentSlide: () => slide });
		expect(() => runner.oleVerb?.(-1, undefined)).not.toThrow();
		runner.oleVerb?.(-1, 'ole1');
		expect(openSpy).not.toHaveBeenCalled();
	});
});

/**
 * presentation-media-transport.test.ts: `ppaction://media` support
 * (wave-4 B7 show runner).
 */
import { describe, expect, it, vi } from 'vitest';

import { toggleStageElementMedia } from './presentation-media-transport';

function stageWithVideo(
	elementId: string,
	paused: boolean,
): { root: HTMLElement; video: HTMLVideoElement } {
	const root = document.createElement('div');
	const wrapper = document.createElement('div');
	wrapper.setAttribute('data-element-id', elementId);
	const video = document.createElement('video');
	Object.defineProperty(video, 'paused', { value: paused, configurable: true });
	vi.spyOn(video, 'play').mockResolvedValue(undefined);
	vi.spyOn(video, 'pause').mockReturnValue(undefined);
	wrapper.appendChild(video);
	root.appendChild(wrapper);
	return { root, video };
}

describe('toggleStageElementMedia', () => {
	it('plays a paused video belonging to the given element', () => {
		const { root, video } = stageWithVideo('el-1', true);
		toggleStageElementMedia(root, 'el-1');
		expect(video.play).toHaveBeenCalledOnce();
		expect(video.pause).not.toHaveBeenCalled();
	});

	it('pauses a playing video belonging to the given element', () => {
		const { root, video } = stageWithVideo('el-1', false);
		toggleStageElementMedia(root, 'el-1');
		expect(video.pause).toHaveBeenCalledOnce();
		expect(video.play).not.toHaveBeenCalled();
	});

	it('is a no-op for an unknown element id', () => {
		const { root, video } = stageWithVideo('el-1', true);
		toggleStageElementMedia(root, 'el-does-not-exist');
		expect(video.play).not.toHaveBeenCalled();
	});

	it('is a no-op with no root or no elementId', () => {
		const { root } = stageWithVideo('el-1', true);
		expect(() => toggleStageElementMedia(null, 'el-1')).not.toThrow();
		expect(() => toggleStageElementMedia(root, undefined)).not.toThrow();
	});
});

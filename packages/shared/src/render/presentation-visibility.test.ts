// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	hasPersistentAudio,
	registerPersistentAudio,
	stopAllPersistentAudio,
} from './media-persistent-audio';
import { attachPresentationVisibilityPause } from './presentation-visibility';

function setVisibility(state: 'visible' | 'hidden'): void {
	Object.defineProperty(document, 'visibilityState', {
		configurable: true,
		get: () => state,
	});
	document.dispatchEvent(new Event('visibilitychange'));
}

function stageWithAudio(): { root: HTMLElement; audio: HTMLAudioElement } {
	const root = document.createElement('div');
	const audio = document.createElement('audio');
	root.appendChild(audio);
	document.body.appendChild(root);
	return { root, audio };
}

beforeEach(() => {
	// jsdom reports hasFocus() false by default; the helper treats an
	// unfocused window as suspended, so pin the baseline to focused.
	vi.spyOn(document, 'hasFocus').mockReturnValue(true);
});

afterEach(() => {
	stopAllPersistentAudio();
	document.body.replaceChildren();
	setVisibilityCleanup();
	vi.restoreAllMocks();
});

function setVisibilityCleanup(): void {
	Object.defineProperty(document, 'visibilityState', {
		configurable: true,
		get: () => 'visible',
	});
}

describe('attachPresentationVisibilityPause', () => {
	it('pauses playing stage media when hidden and resumes it when visible', () => {
		const { root, audio } = stageWithAudio();
		Object.defineProperty(audio, 'paused', { configurable: true, get: () => false });
		const pause = vi.spyOn(audio, 'pause').mockImplementation(() => {});
		const play = vi.spyOn(audio, 'play').mockResolvedValue();

		const detach = attachPresentationVisibilityPause({ root });
		setVisibility('hidden');
		expect(pause).toHaveBeenCalledOnce();

		setVisibility('visible');
		expect(play).toHaveBeenCalledOnce();
		detach();
	});

	it('leaves already-paused media alone on resume', () => {
		const { root, audio } = stageWithAudio();
		const play = vi.spyOn(audio, 'play').mockResolvedValue();

		const detach = attachPresentationVisibilityPause({ root });
		setVisibility('hidden');
		setVisibility('visible');
		expect(play).not.toHaveBeenCalled();
		detach();
	});

	it('suspends and re-arms the auto-advance timer via the callbacks', () => {
		const onHidden = vi.fn();
		const onVisible = vi.fn();
		const detach = attachPresentationVisibilityPause({ onHidden, onVisible });

		setVisibility('hidden');
		expect(onHidden).toHaveBeenCalledOnce();
		expect(onVisible).not.toHaveBeenCalled();

		setVisibility('visible');
		expect(onVisible).toHaveBeenCalledOnce();
		detach();
	});

	it('stops reacting after detach', () => {
		const onHidden = vi.fn();
		const detach = attachPresentationVisibilityPause({ onHidden });
		detach();
		setVisibility('hidden');
		expect(onHidden).not.toHaveBeenCalled();
	});

	it('suspends when the WINDOW loses focus even though the tab stays visible', () => {
		// Issue #132: alt-tabbing to another application leaves the tab
		// visible, so visibilitychange never fires; the blur signal must
		// pause the show.
		const onHidden = vi.fn();
		const onVisible = vi.fn();
		const hasFocus = vi.spyOn(document, 'hasFocus').mockReturnValue(false);
		const detach = attachPresentationVisibilityPause({ onHidden, onVisible });

		window.dispatchEvent(new Event('blur'));
		expect(onHidden).toHaveBeenCalledOnce();

		hasFocus.mockReturnValue(true);
		window.dispatchEvent(new Event('focus'));
		expect(onVisible).toHaveBeenCalledOnce();
		detach();
		hasFocus.mockRestore();
	});

	it('does not double-suspend when blur and tab-hide overlap', () => {
		const onHidden = vi.fn();
		const onVisible = vi.fn();
		const hasFocus = vi.spyOn(document, 'hasFocus').mockReturnValue(false);
		const detach = attachPresentationVisibilityPause({ onHidden, onVisible });

		window.dispatchEvent(new Event('blur'));
		setVisibility('hidden');
		expect(onHidden).toHaveBeenCalledOnce();

		// Still unfocused: becoming visible alone must NOT resume.
		setVisibility('visible');
		expect(onVisible).not.toHaveBeenCalled();

		hasFocus.mockReturnValue(true);
		window.dispatchEvent(new Event('focus'));
		expect(onVisible).toHaveBeenCalledOnce();
		detach();
		hasFocus.mockRestore();
	});

	it('pauses persistent (cross-slide) audio while hidden and resumes it', () => {
		const playSpy = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
		const pauseSpy = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
		registerPersistentAudio('el-1', 'data:audio/mp3;base64,', 'audio/mpeg', true, 0.8, 0);
		expect(hasPersistentAudio('el-1')).toBeTruthy();
		// The manager's element reports paused=false while "playing".
		const el = document.querySelector<HTMLAudioElement>('[data-pptx-persistent-audio="el-1"]');
		Object.defineProperty(el, 'paused', { configurable: true, get: () => false });
		playSpy.mockClear();
		pauseSpy.mockClear();

		const detach = attachPresentationVisibilityPause({ root: document.createElement('div') });
		setVisibility('hidden');
		expect(pauseSpy).toHaveBeenCalledOnce();

		setVisibility('visible');
		expect(playSpy).toHaveBeenCalledOnce();
		detach();
		playSpy.mockRestore();
		pauseSpy.mockRestore();
	});
});

describe('persistent audio manager', () => {
	it('is idempotent per element id and tears down on stopAll', () => {
		vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
		registerPersistentAudio('el-2', 'data:audio/mp3;base64,', undefined, false, 2, 0);
		registerPersistentAudio('el-2', 'data:audio/mp3;base64,', undefined, false, 2, 0);
		expect(document.querySelectorAll('[data-pptx-persistent-audio="el-2"]')).toHaveLength(1);
		// Volume is clamped into [0, 1].
		const el = document.querySelector<HTMLAudioElement>('[data-pptx-persistent-audio="el-2"]');
		expect(el?.volume).toBe(1);

		stopAllPersistentAudio();
		expect(hasPersistentAudio('el-2')).toBeFalsy();
		expect(document.querySelectorAll('[data-pptx-persistent-audio]')).toHaveLength(0);
	});
});

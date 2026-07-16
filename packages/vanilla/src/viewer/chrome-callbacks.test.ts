import { describe, expect, it, vi } from 'vitest';

import { buildChromeCallbacks } from './chrome-callbacks';
import type { ChromeCallbackDeps } from './chrome-callbacks';

function buildDeps(overrides: Partial<ChromeCallbackDeps>): ChromeCallbackDeps {
	return new Proxy(overrides as ChromeCallbackDeps, {
		get(target, property, receiver) {
			return Reflect.get(target, property, receiver) ?? vi.fn();
		},
	});
}

describe('buildChromeCallbacks', () => {
	it('routes settings and Record commands into viewer workflows', () => {
		const openSettings = vi.fn();
		const startRehearsal = vi.fn();
		const openShare = vi.fn();
		const toggleSubtitles = vi.fn();
		const openSetUpSlideShow = vi.fn();
		const callbacks = buildChromeCallbacks(
			buildDeps({
				openSettings,
				startRehearsal,
				openShare,
				toggleSubtitles,
				openSetUpSlideShow,
			}),
		);

		callbacks.ribbonHandlers.nav.openSettings('shortcuts');
		callbacks.ribbonHandlers.file.openSettings();
		callbacks.ribbonHandlers.file.openShare();
		callbacks.ribbonHandlers.slideShow.startRehearsal();
		callbacks.ribbonHandlers.slideShow.toggleSubtitles();
		callbacks.ribbonHandlers.slideShow.openSubtitleSettings();

		expect(openSettings.mock.calls).toStrictEqual([['shortcuts'], ['general']]);
		expect(startRehearsal).toHaveBeenCalledOnce();
		expect(openShare).toHaveBeenCalledOnce();
		expect(toggleSubtitles).toHaveBeenCalledOnce();
		expect(openSetUpSlideShow).toHaveBeenCalledOnce();
	});
});

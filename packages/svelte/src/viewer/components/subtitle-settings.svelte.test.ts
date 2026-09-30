import { flushSync, mount, unmount } from 'svelte';
import { describe, expect, it, vi } from 'vitest';

import { ViewerOptionsState } from '../state/viewer-options.svelte';
import PresentationSubtitleBar from './PresentationSubtitleBar.svelte';
import SubtitleSettingsControl from './ribbon/slideshow/SubtitleSettingsControl.svelte';

let options: ViewerOptionsState;
vi.mock(import('../state/viewer-options-context'), () => ({ useViewerOptions: () => options }));

describe('subtitle settings adapter', () => {
	it('commits preferences and restarts recognition with the selected language', () => {
		options = new ViewerOptionsState({ persist: false });
		options.setValue('accessibility', 'subtitleLanguage', 'fr-FR');
		const starts: string[] = [];
		class Recognition extends EventTarget {
			lang = '';
			start() {
				starts.push(this.lang);
			}
			stop() {}
		}
		vi.stubGlobal('SpeechRecognition', Recognition);
		const target = document.createElement('div');
		const control = mount(SubtitleSettingsControl, { target });
		const bar = mount(PresentationSubtitleBar, { target, props: { enabled: true } });
		try {
			flushSync();
			expect(starts).toContain('fr-FR');
			target
				.querySelector('pptx-ui-subtitle-settings')!
				.dispatchEvent(
					new CustomEvent('subtitle-settings-change', { detail: { spokenLanguage: 'de-DE' } }),
				);
			flushSync();
			expect(options.options.accessibility.subtitleLanguage).toBe('de-DE');
			expect(starts).toContain('de-DE');
		} finally {
			unmount(control);
			unmount(bar);
			options.dispose();
			vi.unstubAllGlobals();
		}
	});
});

import { mount } from '@vue/test-utils';
import { createViewerOptionsStore } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';
import { shallowRef } from 'vue';

import { ViewerOptionsKey, ViewerOptionsStoreKey } from '../../composables/useViewerOptionsStore';
import PresentationSubtitleBar from '../PresentationSubtitleBar.vue';
import SubtitleSettingsControl from './SubtitleSettingsControl.vue';

describe('subtitle settings adapter', () => {
	it('commits into the supplied store and passes the chosen language to recognition', () => {
		const store = createViewerOptionsStore({ persist: false });
		store.setValue('accessibility', 'subtitleLanguage', 'fr-FR');
		const starts: string[] = [];
		class Recognition extends EventTarget {
			lang = '';
			start() {
				starts.push(this.lang);
			}
			stop() {}
		}
		vi.stubGlobal('SpeechRecognition', Recognition);
		const wrapper = mount(SubtitleSettingsControl, {
			global: { provide: { [ViewerOptionsStoreKey as symbol]: store } },
		});
		const bar = mount(PresentationSubtitleBar, {
			props: { visible: true },
			global: { provide: { [ViewerOptionsKey as symbol]: shallowRef(store.getOptions()) } },
		});
		try {
			expect(starts).toContain('fr-FR');
			wrapper
				.find('pptx-ui-subtitle-settings')
				.element.dispatchEvent(
					new CustomEvent('subtitle-settings-change', { detail: { spokenLanguage: 'de-DE' } }),
				);
			expect(store.getOptions().accessibility.subtitleLanguage).toBe('de-DE');
		} finally {
			wrapper.unmount();
			bar.unmount();
			vi.unstubAllGlobals();
		}
	});
});

import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';

import PresentationSubtitleBar from './PresentationSubtitleBar.vue';

describe('presentationSubtitleBar', () => {
	afterEach(() => {
		// Clean up any injected SpeechRecognition stub.
		delete (window as unknown as Record<string, unknown>).SpeechRecognition;
		delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
	});

	it('renders nothing when not visible', () => {
		const wrapper = mount(PresentationSubtitleBar, { props: { visible: false } });
		expect(wrapper.find('.pptx-vue-subtitle-bar').exists()).toBeFalsy();
	});

	it('shows the unsupported message when SpeechRecognition is absent', () => {
		const wrapper = mount(PresentationSubtitleBar, { props: { visible: true } });
		expect(wrapper.find('.pptx-vue-subtitle-text').text()).toContain('not supported');
	});

	it('shows the listening prompt when recognition is supported', () => {
		class StubRecognition {
			continuous = false;
			interimResults = false;
			lang = '';
			onresult: ((event: Event) => void) | null = null;
			onerror: ((event: Event) => void) | null = null;
			onend: (() => void) | null = null;
			start(): void {
				/* no-op */
			}
			stop(): void {
				/* no-op */
			}
		}
		(window as unknown as Record<string, unknown>).SpeechRecognition = StubRecognition;

		const wrapper = mount(PresentationSubtitleBar, { props: { visible: true } });
		expect(wrapper.find('.pptx-vue-subtitle-text').text()).toContain('Listening');
	});
});

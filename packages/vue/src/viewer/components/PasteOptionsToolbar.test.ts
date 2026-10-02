import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import PasteOptionsToolbar from './PasteOptionsToolbar.vue';

beforeEach(() => {
	const viewport = document.createElement('div');
	viewport.setAttribute('data-pptx-viewport', '');
	const pasted = document.createElement('div');
	pasted.setAttribute('data-element-id', 'pasted-1');
	pasted.getBoundingClientRect = () => ({ right: 300, bottom: 200 }) as DOMRect;
	viewport.append(pasted);
	document.body.append(viewport);
});
afterEach(() => document.body.replaceChildren());

const shadow = (wrapper: ReturnType<typeof mount>) => (wrapper.element as HTMLElement).shadowRoot!;

describe('pasteOptionsToolbar adapter', () => {
	it('renders nothing without a pasted element', async () => {
		const wrapper = mount(PasteOptionsToolbar, { props: { elementId: null } });
		await flushPromises();
		expect(wrapper.find('pptx-ui-paste-options').exists()).toBeFalsy();
	});

	it('anchors the shared strip to the pasted element and emits the chosen format', async () => {
		const wrapper = mount(PasteOptionsToolbar, { props: { elementId: 'pasted-1' } });
		await flushPromises();
		expect(wrapper.element.hasAttribute('data-pptx-paste-options')).toBeTruthy();
		expect((wrapper.element as HTMLElement).style.left).toBe('304px');
		expect((wrapper.element as HTMLElement).style.top).toBe('204px');
		const buttons = shadow(wrapper).querySelectorAll('button');
		expect(buttons).toHaveLength(4);
		buttons[1].click();
		expect(wrapper.emitted('choose')).toStrictEqual([['use-destination-theme']]);
	});

	it('re-emits the strip dismissal intent', async () => {
		const wrapper = mount(PasteOptionsToolbar, { props: { elementId: 'pasted-1' } });
		await flushPromises();
		wrapper.element.dispatchEvent(new CustomEvent('paste-options-dismiss'));
		expect(wrapper.emitted('dismiss')).toHaveLength(1);
	});
});

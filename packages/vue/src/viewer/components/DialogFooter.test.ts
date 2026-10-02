import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';

import DialogFooter from './DialogFooter.vue';
import KeepAnnotationsDialog from './KeepAnnotationsDialog.vue';
import PasteSpecialDialog from './PasteSpecialDialog.vue';
import SignatureStrippedDialog from './SignatureStrippedDialog.vue';

afterEach(() => document.body.replaceChildren());

/** The dialogs teleport to <body>, so look the footer element up globally. */
const footerButtons = () =>
	Array.from(
		document.querySelector('pptx-ui-dialog-footer')!.shadowRoot!.querySelectorAll('button'),
	);

describe('dialogFooter adapter', () => {
	it('renders the actions in the shared footer and emits the activated id', () => {
		const wrapper = mount(DialogFooter, {
			props: {
				actions: [
					{ id: 'cancel', label: 'Cancel' },
					{ id: 'ok', label: 'OK', variant: 'primary' },
				],
			},
		});
		const buttons = Array.from(
			(wrapper.element as HTMLElement).shadowRoot!.querySelectorAll('button'),
		);
		expect(buttons.map((b) => b.textContent)).toStrictEqual(['Cancel', 'OK']);
		expect(buttons[1].className).toBe('primary');
		buttons[1].click();
		expect(wrapper.emitted('action')).toStrictEqual([['ok']]);
	});
});

describe('dialogs on the shared footer', () => {
	it('keepAnnotationsDialog emits keep and discard from its footer', () => {
		const wrapper = mount(KeepAnnotationsDialog, {
			props: { open: true, annotationCount: 3, slideCount: 2 },
			attachTo: document.body,
		});
		const [discard, keep] = footerButtons();
		keep.click();
		discard.click();
		expect(wrapper.emitted('keep')).toHaveLength(1);
		expect(wrapper.emitted('discard')).toHaveLength(1);
	});

	it('signatureStrippedDialog emits confirm and cancel from its footer', () => {
		const wrapper = mount(SignatureStrippedDialog, {
			props: { open: true, signatureCount: 1 },
			attachTo: document.body,
		});
		const [cancel, confirm] = footerButtons();
		expect(confirm.className).toBe('warning');
		confirm.click();
		cancel.click();
		expect(wrapper.emitted('confirm')).toHaveLength(1);
		expect(wrapper.emitted('cancel')).toHaveLength(1);
	});

	it('pasteSpecialDialog confirms the default format from OK', () => {
		const wrapper = mount(PasteSpecialDialog, {
			props: { open: true },
			attachTo: document.body,
		});
		const [cancel, ok] = footerButtons();
		ok.click();
		cancel.click();
		expect(wrapper.emitted('confirm')).toStrictEqual([['keep-source-formatting']]);
		expect(wrapper.emitted('cancel')).toHaveLength(1);
	});
});

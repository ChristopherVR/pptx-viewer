import { registerPptxWebControls } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import AutosaveRecoveryDialog from './AutosaveRecoveryDialog.svelte';
import DialogFooter from './DialogFooter.svelte';
import KeepAnnotationsDialog from './KeepAnnotationsDialog.svelte';
import PasteOptionsToolbar from './PasteOptionsToolbar.svelte';
import PasteSpecialDialog from './PasteSpecialDialog.svelte';
import SignatureStrippedDialog from './SignatureStrippedDialog.svelte';

registerPptxWebControls();

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
	document.body.replaceChildren();
});

function open(component: never, props: Record<string, unknown>): HTMLElement {
	const target = document.createElement('div');
	document.body.append(target);
	const instance = mount(component, { target, props });
	flushSync();
	cleanup = () => unmount(instance);
	return target;
}

const buttons = (target: HTMLElement, tag = 'pptx-ui-dialog-footer') =>
	Array.from(target.querySelector(tag)!.shadowRoot!.querySelectorAll('button'));

describe('dialogFooter adapter', () => {
	it('renders the actions in the shared footer and routes the activated id', () => {
		const onaction = vi.fn();
		const target = open(DialogFooter as never, {
			actions: [
				{ id: 'cancel', label: 'Cancel' },
				{ id: 'ok', label: 'OK', variant: 'primary' },
			],
			onaction,
		});
		const [cancel, ok] = buttons(target);
		expect(cancel.textContent).toBe('Cancel');
		expect(ok.className).toBe('primary');
		ok.click();
		expect(onaction).toHaveBeenCalledWith('ok');
	});
});

describe('dialogs on the shared footer', () => {
	it('keepAnnotationsDialog keeps or discards from its footer', () => {
		const onkeep = vi.fn();
		const ondiscard = vi.fn();
		const target = open(KeepAnnotationsDialog as never, {
			annotationCount: 3,
			slideCount: 2,
			onkeep,
			ondiscard,
		});
		const [discard, keep] = buttons(target);
		keep.click();
		discard.click();
		expect(onkeep).toHaveBeenCalledOnce();
		expect(ondiscard).toHaveBeenCalledOnce();
	});

	it('signatureStrippedDialog closes from either footer action', () => {
		const onclose = vi.fn();
		const target = open(SignatureStrippedDialog as never, { signatureCount: 1, onclose });
		const [cancel, confirm] = buttons(target);
		expect(confirm.className).toBe('warning');
		cancel.click();
		confirm.click();
		expect(onclose).toHaveBeenCalledTimes(2);
	});

	it('pasteSpecialDialog confirms the default format from OK and cancels from Cancel', () => {
		const onconfirm = vi.fn();
		const oncancel = vi.fn();
		const target = open(PasteSpecialDialog as never, { onconfirm, oncancel });
		const [cancel, ok] = buttons(target);
		ok.click();
		cancel.click();
		expect(onconfirm).toHaveBeenCalledWith('keep-source-formatting');
		expect(oncancel).toHaveBeenCalledOnce();
	});

	it('autosaveRecoveryDialog disables both actions while discarding', () => {
		const prompt = {
			titleKey: 'pptx.autosave.recovery.title',
			messageKey: 'pptx.autosave.recovery.message',
			ageKey: 'pptx.autosave.recovery.ageJustNow',
			discardKey: 'pptx.autosave.recovery.discard',
			restoreKey: 'pptx.autosave.recovery.restore',
		};
		const onrestore = vi.fn();
		const target = open(AutosaveRecoveryDialog as never, {
			prompt,
			discarding: true,
			onrestore,
			ondiscard: vi.fn(),
		});
		expect(buttons(target).map((b) => b.disabled)).toStrictEqual([true, true]);
	});
});

describe('pasteOptionsToolbar adapter', () => {
	it('anchors the shared strip to the pasted element and routes the chosen format', async () => {
		const viewport = document.createElement('div');
		viewport.setAttribute('data-pptx-viewport', '');
		const pasted = document.createElement('div');
		pasted.setAttribute('data-element-id', 'pasted-1');
		pasted.getBoundingClientRect = () => ({ right: 300, bottom: 200 }) as DOMRect;
		viewport.append(pasted);
		document.body.append(viewport);
		const onchoose = vi.fn();
		const target = open(PasteOptionsToolbar as never, {
			elementId: 'pasted-1',
			onchoose,
			ondismiss: vi.fn(),
		});
		await new Promise<void>((resolve) => {
			requestAnimationFrame(() => resolve());
		});
		flushSync();
		const host = target.querySelector('pptx-ui-paste-options')!;
		expect(host.hasAttribute('data-pptx-paste-options')).toBeTruthy();
		expect((host as HTMLElement).style.left).toBe('304px');
		buttons(target, 'pptx-ui-paste-options')[0].click();
		expect(onchoose).toHaveBeenCalledWith('keep-source-formatting');
	});
});

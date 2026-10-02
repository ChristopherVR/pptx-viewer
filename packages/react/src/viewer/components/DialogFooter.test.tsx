// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AutosaveRecoveryDialog } from './AutosaveRecoveryDialog';
import { DialogFooter } from './DialogFooter';
import { KeepAnnotationsDialog } from './KeepAnnotationsDialog';
import { PasteSpecialDialog } from './PasteSpecialDialog';
import { SignatureStrippedDialog } from './SignatureStrippedDialog';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
});

const footerButtons = () =>
	Array.from(
		container.querySelector('pptx-ui-dialog-footer')!.shadowRoot!.querySelectorAll('button'),
	);

describe('dialogFooter adapter', () => {
	it('renders the actions in the shared footer and routes the activated id', () => {
		const onAction = vi.fn();
		act(() =>
			root.render(
				<DialogFooter
					onAction={onAction}
					actions={[
						{ id: 'cancel', label: 'Cancel' },
						{ id: 'ok', label: 'OK', variant: 'primary' },
					]}
				/>,
			),
		);
		const [cancel, ok] = footerButtons();
		expect(cancel.textContent).toBe('Cancel');
		expect(ok.className).toBe('primary');
		act(() => ok.click());
		expect(onAction).toHaveBeenCalledWith('ok');
	});
});

describe('dialogs on the shared footer', () => {
	it('keepAnnotationsDialog keeps or discards from its footer', () => {
		const onKeep = vi.fn();
		const onDiscard = vi.fn();
		act(() =>
			root.render(
				<KeepAnnotationsDialog
					isOpen
					annotationCount={3}
					slideCount={2}
					onKeep={onKeep}
					onDiscard={onDiscard}
				/>,
			),
		);
		const [discard, keep] = footerButtons();
		act(() => keep.click());
		act(() => discard.click());
		expect(onKeep).toHaveBeenCalledOnce();
		expect(onDiscard).toHaveBeenCalledOnce();
	});

	it('signatureStrippedDialog confirms or cancels from its footer', () => {
		const onConfirm = vi.fn();
		const onCancel = vi.fn();
		act(() =>
			root.render(
				<SignatureStrippedDialog
					isOpen
					signatureCount={1}
					onConfirm={onConfirm}
					onCancel={onCancel}
				/>,
			),
		);
		const [cancel, confirm] = footerButtons();
		expect(confirm.className).toBe('warning');
		act(() => confirm.click());
		act(() => cancel.click());
		expect(onConfirm).toHaveBeenCalledOnce();
		expect(onCancel).toHaveBeenCalledOnce();
	});

	it('pasteSpecialDialog confirms the selected format from OK and cancels from Cancel', () => {
		const onConfirm = vi.fn();
		const onCancel = vi.fn();
		act(() => root.render(<PasteSpecialDialog isOpen onConfirm={onConfirm} onCancel={onCancel} />));
		const [cancel, ok] = footerButtons();
		act(() => ok.click());
		act(() => cancel.click());
		expect(onConfirm).toHaveBeenCalledWith('keep-source-formatting');
		expect(onCancel).toHaveBeenCalledOnce();
	});

	it('autosaveRecoveryDialog disables both actions while busy', () => {
		const prompt = {
			titleKey: 'pptx.autosave.recovery.title',
			messageKey: 'pptx.autosave.recovery.message',
			ageKey: 'pptx.autosave.recovery.ageJustNow',
			discardKey: 'pptx.autosave.recovery.discard',
			restoreKey: 'pptx.autosave.recovery.restore',
		};
		const onRestore = vi.fn();
		act(() =>
			root.render(
				<AutosaveRecoveryDialog
					prompt={prompt as never}
					onRestore={onRestore}
					onDiscard={vi.fn()}
					busy={false}
				/>,
			),
		);
		expect(footerButtons().map((b) => b.disabled)).toStrictEqual([false, false]);
		act(() => footerButtons()[1].click());
		expect(onRestore).toHaveBeenCalledOnce();
		act(() =>
			root.render(
				<AutosaveRecoveryDialog
					prompt={prompt as never}
					onRestore={onRestore}
					onDiscard={vi.fn()}
					busy
				/>,
			),
		);
		expect(footerButtons().map((b) => b.disabled)).toStrictEqual([true, true]);
	});
});

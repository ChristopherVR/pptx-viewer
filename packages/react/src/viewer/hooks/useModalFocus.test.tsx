// @vitest-environment happy-dom
/**
 * Regression tests for `useModalFocus` callback-identity churn.
 *
 * Callers pass inline `onClose` handlers, so the prop's identity changes on
 * every parent render. The hook used to list `onClose` in its effect deps:
 * each parent render tore down and re-armed the shared focus trap, which
 * restored focus to the opener and then snapped it to the dialog's first
 * control, yanking focus away from whatever input the user had clicked
 * (live-reproduced in the Share dialog: focus always ended on the x close
 * button and typed text landed nowhere). The trap must arm once per open,
 * while Escape still reaches the LATEST callback.
 */
import React, { act, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useModalFocus } from './useModalFocus';

function DialogHarness({ onClose }: { onClose: () => void }): React.ReactElement {
	const panelRef = useRef<HTMLDivElement>(null);
	useModalFocus(true, panelRef, onClose);
	return (
		<div ref={panelRef} role='dialog' tabIndex={-1}>
			<button type='button'>close</button>
			<input id='field-a' />
			<input id='field-b' />
		</div>
	);
}

describe('useModalFocus', () => {
	let container: HTMLDivElement;
	let root: Root;

	beforeEach(() => {
		container = document.createElement('div');
		document.body.appendChild(container);
		root = createRoot(container);
	});

	afterEach(async () => {
		await act(async () => root.unmount());
		container.remove();
	});

	it('does not re-arm the trap (and steal focus) when onClose changes identity', async () => {
		await act(async () => {
			root.render(<DialogHarness onClose={() => {}} />);
		});
		// The trap's initial-focus microtask has run; now the user clicks a field.
		const field = document.getElementById('field-a') as HTMLInputElement;
		await act(async () => {
			field.focus();
		});
		expect(document.activeElement).toBe(field);

		// Parent re-renders with a fresh inline onClose. The old implementation
		// re-ran the effect here: cleanup restored focus to the opener, re-arm
		// snapped it to the first control (the close button).
		await act(async () => {
			root.render(<DialogHarness onClose={() => {}} />);
		});
		expect(document.activeElement).toBe(field);
	});

	it('routes Escape to the latest onClose callback', async () => {
		const initial = vi.fn<() => void>();
		const latest = vi.fn<() => void>();
		await act(async () => {
			root.render(<DialogHarness onClose={initial} />);
		});
		await act(async () => {
			root.render(<DialogHarness onClose={latest} />);
		});

		await act(async () => {
			document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
		});
		expect(initial).not.toHaveBeenCalled();
		expect(latest).toHaveBeenCalledOnce();
	});
});

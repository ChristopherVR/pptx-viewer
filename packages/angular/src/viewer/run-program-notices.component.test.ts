/**
 * run-program-notices.component.test.ts: "Run program" notice stack.
 *
 * No Angular TestBed (see `compat-toasts.component.test.ts` for the same
 * technique in this package): the component is instantiated directly for the
 * clipboard-availability + stack-style assertions, and the template is read
 * off the source file for the wiring the DOM can't be rendered here to prove,
 * including the stable e2e selectors (`pptx-run-program-notice[-copy]`,
 * `data-target`) a cross-binding Playwright spec depends on.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { Injector, runInInjectionContext, signal } from '@angular/core';
import type { InputSignal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';

import { canUseClipboard } from '../internal/shared';
import type { RunProgramNotice } from '../internal/shared';
import { RUN_PROGRAM_NOTICE_STACK_STYLE } from './presentation-overlay-chrome-styles';
import { RunProgramNoticesComponent } from './run-program-notices.component';

function notice(overrides: Partial<RunProgramNotice> = {}): RunProgramNotice {
	return {
		id: 'run-program-1',
		target: 'notepad.exe C:\\temp\\notes.txt',
		messageKey: 'pptx.presentation.runProgramNotice',
		copyLabelKey: 'pptx.presentation.runProgramCopy',
		...overrides,
	};
}

function createComponent(notices: readonly RunProgramNotice[]): RunProgramNoticesComponent {
	const component = runInInjectionContext(
		Injector.create({ providers: [] }),
		() => new RunProgramNoticesComponent(),
	);
	Object.assign(component, {
		notices: signal(notices) as unknown as InputSignal<readonly RunProgramNotice[]>,
	});
	return component;
}

describe('runProgramNoticesComponent stack style + clipboard gating', () => {
	it('positions the stack via the overlay chrome metrics', () => {
		const component = createComponent([notice()]);
		expect(component['stackStyle']).toBe(RUN_PROGRAM_NOTICE_STACK_STYLE);
	});

	it('clipboardAvailable is computed from the shared canUseClipboard(navigator) check', () => {
		// The test DOM's own navigator varies by runtime (happy-dom polyfills
		// Clipboard, jsdom does not), so this asserts the WIRING - the same
		// shared decision the copy button's guard reads - rather than hard-coding
		// which way that decision goes in any one environment.
		const component = createComponent([notice()]);
		expect(component['clipboardAvailable']).toBe(
			canUseClipboard(typeof navigator === 'undefined' ? undefined : navigator),
		);
	});

	it('copy() writes the exact target string when the clipboard is available', () => {
		const component = createComponent([notice()]);
		Object.assign(component, { clipboardAvailable: true });
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, 'clipboard', {
			value: { writeText },
			configurable: true,
		});

		component['copy']('notepad.exe C:\\temp\\notes.txt');

		expect(writeText).toHaveBeenCalledWith('notepad.exe C:\\temp\\notes.txt');
	});

	it('copy() is a no-op (never touches the clipboard) when unavailable', () => {
		const component = createComponent([notice()]);
		Object.assign(component, { clipboardAvailable: false });
		const writeText = vi.fn();
		Object.defineProperty(navigator, 'clipboard', {
			value: { writeText },
			configurable: true,
		});

		expect(() => component['copy']('notepad.exe')).not.toThrow();
		expect(writeText).not.toHaveBeenCalled();
	});
});

describe('runProgramNoticesComponent template wiring (source-level)', () => {
	const source = readFileSync(path.join(__dirname, 'run-program-notices.component.ts'), 'utf8');

	it('carries the stable e2e selectors a cross-binding spec depends on', () => {
		expect(source).toContain('data-testid="pptx-run-program-notice"');
		expect(source).toContain('data-testid="pptx-run-program-notice-copy"');
		expect(source).toContain('data-testid="pptx-run-program-notice-dismiss"');
	});

	it('exposes the exact resolved command as a data-target attribute, independent of i18n', () => {
		expect(source).toContain('[attr.data-target]="notice.target"');
	});

	it('interpolates the target into the translated message', () => {
		expect(source).toContain('notice.messageKey | translate: { target: notice.target }');
	});

	it('gates the Copy button on clipboardAvailable rather than always rendering it', () => {
		const copyIndex = source.indexOf('pptx-run-program-notice-copy');
		const guardIndex = source.lastIndexOf('@if (clipboardAvailable)', copyIndex);
		expect(guardIndex).toBeGreaterThan(-1);
	});
});

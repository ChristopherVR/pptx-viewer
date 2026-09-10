// @vitest-environment happy-dom
import type { RunProgramNotice } from 'pptx-viewer-shared';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { useRunProgramNoticesState } from './useRunProgramNoticesState';
import type { UseRunProgramNoticesStateResult } from './useRunProgramNoticesState';

let latest: UseRunProgramNoticesStateResult | null = null;

function Harness() {
	latest = useRunProgramNoticesState();
	return null;
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
	act(() => root?.unmount());
	host?.remove();
	root = null;
	host = null;
	latest = null;
});

function render(): void {
	host = document.createElement('div');
	document.body.appendChild(host);
	root = createRoot(host);
	act(() => {
		root?.render(<Harness />);
	});
}

function notice(id: string, target = 'notepad.exe'): RunProgramNotice {
	return {
		id,
		target,
		messageKey: 'pptx.presentation.runProgramNotice',
		copyLabelKey: 'pptx.presentation.runProgramCopy',
	};
}

describe('useRunProgramNoticesState', () => {
	it('starts empty', () => {
		render();
		expect(latest?.notices).toStrictEqual([]);
	});

	it('addNotice appends, so the same target clicked twice shows two toasts', () => {
		render();
		act(() => {
			latest?.addNotice(notice('run-program-1'));
			latest?.addNotice(notice('run-program-2'));
		});
		expect(latest?.notices.map((n) => n.id)).toStrictEqual(['run-program-1', 'run-program-2']);
	});

	it('dismiss removes only the matching notice by id', () => {
		render();
		act(() => {
			latest?.addNotice(notice('run-program-1'));
			latest?.addNotice(notice('run-program-2'));
		});
		act(() => {
			latest?.dismiss('run-program-1');
		});
		expect(latest?.notices.map((n) => n.id)).toStrictEqual(['run-program-2']);
	});

	it('dismissAll clears every notice', () => {
		render();
		act(() => {
			latest?.addNotice(notice('run-program-1'));
		});
		act(() => {
			latest?.dismissAll();
		});
		expect(latest?.notices).toStrictEqual([]);
	});
});

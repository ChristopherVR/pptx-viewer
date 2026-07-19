// @vitest-environment happy-dom
import type { PptxSlide } from 'pptx-viewer-core';
import type { PptxAiFocusedTarget } from 'pptx-viewer-shared/ai';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// oxlint-disable-next-line prefer-ending-with-an-expect
vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string, opts?: Record<string, unknown>) => {
			const fallback = translationsEn[key] ?? key;
			return opts
				? fallback.replace(/\{\{(\w+)\}\}/gu, (_m, name: string) => String(opts[name] ?? ''))
				: fallback;
		},
	}),
}));

const { AiFocusBar } = await import('./AiFocusBar');

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	globalThis.IS_REACT_ACT_ENVIRONMENT = true;
	container = document.createElement('div');
	document.body.appendChild(container);
	root = createRoot(container);
});

afterEach(() => {
	act(() => root.unmount());
	container.remove();
	globalThis.IS_REACT_ACT_ENVIRONMENT = false;
});

function tableSlides(): PptxSlide[] {
	return [
		{
			id: 's0',
			slideNumber: 1,
			elements: [
				{ id: 'tbl-a', type: 'table', x: 0, y: 0, width: 100, height: 40 },
				{ id: 'tbl-b', type: 'table', x: 0, y: 60, width: 100, height: 40 },
			],
		},
	] as unknown as PptxSlide[];
}

describe('aiFocusBar merge action', () => {
	it('shows a merge button for two tables and sends a directive naming both ids', () => {
		const targets: PptxAiFocusedTarget[] = [
			{ kind: 'element', slideIndex: 0, elementId: 'tbl-a' },
			{ kind: 'element', slideIndex: 0, elementId: 'tbl-b' },
		];
		let sent = '';
		act(() =>
			root.render(
				<AiFocusBar
					targets={targets}
					slides={tableSlides()}
					isPinned={false}
					onPin={() => {}}
					onClearPin={() => {}}
					onSendDirective={(text) => {
						sent = text;
					}}
					pickMode={false}
					hasPicks={false}
					onStartPick={() => {}}
					onStopPick={() => {}}
					onClearPicks={() => {}}
				/>,
			),
		);

		const mergeBtn = [...container.querySelectorAll('button')].find((b) =>
			b.textContent?.includes('Merge selected tables'),
		);
		expect(mergeBtn).toBeTruthy();

		act(() => mergeBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

		expect(sent).toContain('elementIdA=tbl-a');
		expect(sent).toContain('elementIdB=tbl-b');
		expect(sent).toContain('merge_tables');
		expect(sent.toLowerCase()).toContain('do not ask');
	});

	it('hides the merge button when the focus is not two tables', () => {
		act(() =>
			root.render(
				<AiFocusBar
					targets={[{ kind: 'slide', slideIndex: 0 }]}
					slides={tableSlides()}
					isPinned={false}
					onPin={() => {}}
					onClearPin={() => {}}
					onSendDirective={() => {}}
					pickMode={false}
					hasPicks={false}
					onStartPick={() => {}}
					onStopPick={() => {}}
					onClearPicks={() => {}}
				/>,
			),
		);
		const mergeBtn = [...container.querySelectorAll('button')].find((b) =>
			b.textContent?.includes('Merge selected tables'),
		);
		expect(mergeBtn).toBeFalsy();
	});
});

describe('aiFocusBar pick mode', () => {
	it('the crosshair button starts picking and the hint shows in pick mode', () => {
		let started = 0;
		const rerender = (pickMode: boolean) =>
			act(() =>
				root.render(
					<AiFocusBar
						targets={[{ kind: 'slide', slideIndex: 0 }]}
						slides={tableSlides()}
						isPinned={false}
						onPin={() => {}}
						onClearPin={() => {}}
						onSendDirective={() => {}}
						pickMode={pickMode}
						hasPicks={false}
						onStartPick={() => {
							started += 1;
						}}
						onStopPick={() => {}}
						onClearPicks={() => {}}
					/>,
				),
			);

		rerender(false);
		const pickBtn = [...container.querySelectorAll('button')].find(
			(b) => b.getAttribute('aria-label') === 'Pick an element for the assistant',
		);
		expect(pickBtn).toBeTruthy();
		expect(container.textContent).not.toContain('Click an element on the slide');

		act(() => pickBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
		expect(started).toBe(1);

		// While picking, the panel prompts the user to click a canvas element.
		rerender(true);
		expect(container.textContent).toContain('Click an element on the slide');
	});
});

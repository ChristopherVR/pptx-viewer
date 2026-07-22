// @vitest-environment happy-dom
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// oxlint-disable-next-line prefer-ending-with-an-expect
vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string) => translationsEn[key] ?? key,
	}),
}));

const { AiToolCallCard } = await import('./AiToolCallCard');
const { toRenderableParts } = await import('./ai-message-parts');

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

/** Build a RenderableToolPart via the real flattener (proves the wiring). */
function toolPart(toolName: string, input: unknown, state: string) {
	const parts = toRenderableParts({
		id: 'm1',
		role: 'assistant',
		parts: [{ type: `tool-${toolName}`, toolCallId: 'c1', state, input } as never],
	} as never);
	const part = parts.find((p) => p.kind === 'tool');
	if (!part || part.kind !== 'tool') {
		throw new Error('no tool part');
	}
	return part;
}

/** Text that is visible WITHOUT expanding any <details> disclosure. */
function visibleText(): string {
	const clone = container.cloneNode(true) as HTMLElement;
	for (const d of clone.querySelectorAll('details')) {
		d.remove();
	}
	return clone.textContent ?? '';
}

describe('aiToolCallCard', () => {
	it('shows a friendly past-tense activity line with a done status', () => {
		act(() =>
			root.render(
				<AiToolCallCard part={toolPart('get_slide', { slideIndex: 4 }, 'output-available')} />,
			),
		);
		expect(visibleText()).toContain('Looked at slide 5');
		expect(visibleText()).toContain('Done');
	});

	it('reads present tense while the tool is still running', () => {
		act(() =>
			root.render(
				<AiToolCallCard part={toolPart('merge_tables', { slideIndex: 2 }, 'input-available')} />,
			),
		);
		expect(visibleText()).toContain('Merging two tables on slide 3');
		expect(visibleText()).toContain('Working');
	});

	it('never leaks element ids in the default view; raw args live in Details', () => {
		const input = {
			slideIndex: 2,
			elementIdA: 'ppt/slides/slide3.xml-graphicFrame-178',
			elementIdB: 'ppt/slides/slide3.xml-graphicFrame-9',
		};
		act(() =>
			root.render(<AiToolCallCard part={toolPart('merge_tables', input, 'output-available')} />),
		);
		// The always-visible activity line is plain language, no ids.
		const shown = visibleText();
		expect(shown).toContain('Merged two tables on slide 3');
		expect(shown).not.toContain('graphicFrame');
		expect(shown).not.toContain('ppt/slides');
		expect(shown).not.toContain('178');
		// The raw args are still available, but only inside the collapsed disclosure.
		const details = container.querySelector('details');
		expect(details).toBeTruthy();
		expect(details?.textContent).toContain('ppt/slides');
	});

	it('surfaces an error message when the tool failed', () => {
		act(() =>
			root.render(
				<AiToolCallCard
					part={{
						kind: 'tool',
						toolName: 'update_element',
						toolCallId: 'c1',
						state: 'output-error',
						input: { slideIndex: 0 },
						output: undefined,
						errorText: 'Element not found',
					}}
				/>,
			),
		);
		expect(visibleText()).toContain('Failed');
		expect(visibleText()).toContain('Element not found');
	});
});

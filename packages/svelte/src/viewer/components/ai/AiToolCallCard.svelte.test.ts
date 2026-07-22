import type { RenderableToolPart } from 'pptx-viewer-shared/ai';
import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import AiToolCallCard from './AiToolCallCard.svelte';

let cleanup: (() => void) | undefined;
afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function toolPart(overrides: Partial<RenderableToolPart> = {}): RenderableToolPart {
	return {
		kind: 'tool',
		toolName: 'update_element',
		toolCallId: 'call-1',
		state: 'output-available',
		input: { slideIndex: 4, elementId: 'ppt/slides/slide5.xml-shape-9', text: 'Hello' },
		output: { ok: true },
		...overrides,
	};
}

function render(part: RenderableToolPart): HTMLElement {
	const target = document.createElement('div');
	const instance = mount(AiToolCallCard, { target, props: { part } });
	cleanup = () => unmount(instance);
	return target;
}

describe('aiToolCallCard (friendly)', () => {
	it('shows a plain-language activity label and hides raw ids by default', () => {
		const target = render(toolPart());
		const label = target.querySelector('.pptx-svelte-ai-tool-label')?.textContent ?? '';
		// A friendly phrase, never the raw tool name or element id.
		expect(label.length).toBeGreaterThan(0);
		expect(label).not.toContain('update_element');
		expect(label).not.toContain('shape-9');
		// Any raw id lives only inside the collapsed Details, never the head row.
		const head = target.querySelector('.pptx-svelte-ai-tool-head')?.textContent ?? '';
		expect(head).not.toContain('shape-9');
		const details = target.querySelector(
			'details.pptx-svelte-ai-tool-details',
		) as HTMLDetailsElement;
		expect(details.open).toBeFalsy();
	});

	it('reveals the raw tool name + args behind a collapsed Details disclosure', () => {
		const target = render(toolPart());
		const details = target.querySelector('details.pptx-svelte-ai-tool-details');
		expect(details).not.toBeNull();
		expect((details as HTMLDetailsElement).open).toBeFalsy();
		const raw = target.querySelector('.pptx-svelte-ai-tool-raw')?.textContent ?? '';
		expect(raw).toContain('Update element');
	});

	it('renders Working / Done / Failed status from the tool state', () => {
		expect(render(toolPart({ state: 'input-available' })).textContent).toContain('Working');
		expect(render(toolPart({ state: 'output-available' })).textContent).toContain('Done');
		const failed = render(toolPart({ state: 'output-error', errorText: 'boom' }));
		expect(failed.textContent).toContain('Failed');
		expect(failed.querySelector('.pptx-svelte-ai-tool-error')?.textContent).toContain('boom');
	});
});

import type { PptxAiUIMessage } from 'pptx-viewer-shared/ai';
import { describe, expect, it } from 'vitest';

import { createTranslator } from '../i18n';
import { renderMessages } from './ai-messages';

const t = createTranslator('en');

function toolMessage(state: string, input: unknown): PptxAiUIMessage {
	return {
		id: 'm1',
		role: 'assistant',
		parts: [{ type: 'tool-get_slide', toolCallId: 'c1', state, input }],
	} as unknown as PptxAiUIMessage;
}

describe('renderMessages friendly tool cards', () => {
	it('renders a plain-language activity phrase, not the raw tool name or ids', () => {
		const host = document.createElement('div');
		renderMessages(document, host, [toolMessage('output-available', { slideIndex: 4 })], t);

		const name = host.querySelector('.pptxv-ai-tool-name');
		expect(name?.textContent).toBe('Looked at slide 5');
		// The friendly label is not the raw snake_case tool name.
		expect(host.textContent).not.toContain('get_slide');
		// Done status is shown.
		expect(host.querySelector('.pptxv-ai-tool-state.is-done')?.textContent).toContain('Done');
	});

	it('hides element ids by default, exposing raw args only behind Details', () => {
		const host = document.createElement('div');
		renderMessages(
			document,
			host,
			[
				toolMessage('output-available', {
					slideIndex: 1,
					elementId: 'ppt/slides/slide1.xml-shape-9',
				}),
			],
			t,
		);
		// The id is never in the always-visible label.
		expect(host.querySelector('.pptxv-ai-tool-name')?.textContent).not.toContain('shape-9');
		// A collapsed disclosure exists but is closed (not open) by default.
		const details = host.querySelector<HTMLDetailsElement>('.pptxv-ai-tool-details');
		expect(details).toBeTruthy();
		expect(details?.open).toBeFalsy();
	});

	it('marks a failed tool call and surfaces its error text', () => {
		const host = document.createElement('div');
		const msg = {
			id: 'm2',
			role: 'assistant',
			parts: [
				{ type: 'tool-update_element', toolCallId: 'c2', state: 'output-error', errorText: 'boom' },
			],
		} as unknown as PptxAiUIMessage;
		renderMessages(document, host, [msg], t);
		expect(host.querySelector('.pptxv-ai-tool-state.is-error')?.textContent).toContain('Failed');
		expect(host.querySelector('.pptxv-ai-tool-error')?.textContent).toBe('boom');
	});

	it('renders full assistant prose without truncation', () => {
		const host = document.createElement('div');
		const long = 'x'.repeat(4000);
		const msg = {
			id: 'm3',
			role: 'assistant',
			parts: [{ type: 'text', text: long }],
		} as unknown as PptxAiUIMessage;
		renderMessages(document, host, [msg], t);
		expect(host.querySelector('.pptxv-ai-msg-text')?.textContent).toHaveLength(4000);
	});
});

// @vitest-environment happy-dom
import type { PptxAiBridge } from 'pptx-viewer-shared/ai';
import { translationsEn } from 'pptx-viewer-shared/i18n';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AiUiMessage } from './ai-message-parts';

// oxlint-disable-next-line prefer-ending-with-an-expect
vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string) => translationsEn[key] ?? key,
	}),
}));

const { AiMessageList } = await import('./AiMessageList');

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

const stubBridge = { applyTheme: () => {} } as unknown as PptxAiBridge;

function textMessage(id: string, role: 'user' | 'assistant', text: string): AiUiMessage {
	return { id, role, parts: [{ type: 'text', text }] } as unknown as AiUiMessage;
}

describe('aiMessageList', () => {
	it('renders long assistant prose in full without truncation', () => {
		const long = `${'This is a deliberately long assistant answer. '.repeat(20)}END_OF_MESSAGE`;
		act(() =>
			root.render(
				<AiMessageList
					messages={[textMessage('m1', 'assistant', long)]}
					isStreaming={false}
					bridge={stubBridge}
				/>,
			),
		);
		// The whole message is in the DOM (not sliced) and its container carries no
		// clamping/truncation utility.
		expect(container.textContent).toContain(long);
		expect(container.textContent).toContain('END_OF_MESSAGE');
		const para = [...container.querySelectorAll('p')].find((p) =>
			(p.textContent ?? '').includes('END_OF_MESSAGE'),
		);
		expect(para).toBeTruthy();
		expect(para?.className ?? '').not.toContain('truncate');
		expect(para?.className ?? '').not.toContain('line-clamp');
		expect(para?.className ?? '').toContain('whitespace-pre-wrap');
	});

	it('shows the friendly empty state when there are no messages', () => {
		act(() => root.render(<AiMessageList messages={[]} isStreaming={false} bridge={stubBridge} />));
		expect(container.textContent).toContain('Ask the assistant');
	});
});

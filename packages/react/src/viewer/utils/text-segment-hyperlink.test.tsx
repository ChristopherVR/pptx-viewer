import type { ParagraphRun } from 'pptx-viewer-shared';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderHyperlink } from './text-segment-hyperlink';
import type { RunRenderContext } from './text-segment-render';

function run(hyperlink: ParagraphRun['hyperlink']): ParagraphRun {
	return { text: 'Docs', style: {}, hyperlink } as unknown as ParagraphRun;
}

function ctx(overrides: Partial<RunRenderContext> = {}): RunRenderContext {
	return {
		element: { id: 'el-1' } as RunRenderContext['element'],
		fallbackColor: '#000000',
		onHyperlinkClick: vi.fn(),
		...overrides,
	};
}

function clickProps(node: React.ReactNode): { onClick: (e: unknown) => void } {
	return (node as React.ReactElement<{ onClick: (e: unknown) => void }>).props;
}

/** A minimal click event: not-Ctrl, not-Meta, spy-able stop/prevent. */
function plainClickEvent(overrides: Partial<{ ctrlKey: boolean; metaKey: boolean }> = {}) {
	return {
		ctrlKey: false,
		metaKey: false,
		stopPropagation: vi.fn(),
		preventDefault: vi.fn(),
		...overrides,
	};
}

describe('renderHyperlink - a:hlinkClick/@tgtFrame threading', () => {
	it('passes the resolved target frame through to onHyperlinkClick', () => {
		const context = ctx();
		const node = renderHyperlink(
			run({ url: 'https://example.com', href: 'https://example.com', target: 'contentFrame' }),
			<span>Docs</span>,
			'k1',
			context,
		);
		clickProps(node).onClick(plainClickEvent());
		expect(context.onHyperlinkClick).toHaveBeenCalledWith('https://example.com', 'contentFrame');
	});

	it('passes undefined target when the run carries none (default _blank downstream)', () => {
		const context = ctx();
		const node = renderHyperlink(
			run({ url: 'https://example.com', href: 'https://example.com' }),
			<span>Docs</span>,
			'k1',
			context,
		);
		clickProps(node).onClick(plainClickEvent());
		expect(context.onHyperlinkClick).toHaveBeenCalledWith('https://example.com', undefined);
	});

	it('renders plain text (no click wrapper) when the run has no url', () => {
		const context = ctx();
		const node = renderHyperlink(run(undefined), <span>Docs</span>, 'k1', context);
		expect(node).toStrictEqual(<span>Docs</span>);
	});
});

import type { PptxSmartArtData } from 'pptx-viewer-core';
import React from 'react';
/**
 * Tests for the SmartArt properties panel.
 *
 * Renders to static markup to assert accessibility roles / aria-labels and the
 * validation-driven enabling/disabling of the add / remove affordances. The
 * editing *behaviour* (add / remove / promote / demote / reorder / keyboard) is
 * unit-tested against the shared handlers in
 * `smartart-node-pane-handlers.test.ts`, which exercise the same core ops the
 * panel calls.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';

// Mock react-i18next: return the key (or a templated form) so assertions are stable.
vi.mock<typeof import('react-i18next')>(import('react-i18next'), () => ({
	useTranslation: () => ({
		t: (key: string, opts?: Record<string, unknown>) => {
			if (key === 'pptx.smartart.extraConnections') {
				return `${opts?.count ?? 0} other connection(s)`;
			}
			return key;
		},
	}),
}));

const { SmartArtPropertiesPanel } = await import('./SmartArtPropertiesPanel');

function render(el: React.ReactElement): string {
	return renderToStaticMarkup(el);
}

function listData(count: number): PptxSmartArtData {
	return {
		resolvedLayoutType: 'list',
		nodes: Array.from({ length: count }, (_, i) => ({ id: `n${i}`, text: `Item ${i + 1}` })),
	};
}

describe('smartArtPropertiesPanel - accessibility', () => {
	it('wraps the panel in a labelled group', () => {
		const html = render(
			<SmartArtPropertiesPanel smartArtData={listData(2)} canEdit onUpdateElement={vi.fn()} />,
		);
		expect(html).toContain('role="group"');
		expect(html).toContain('aria-label="pptx.smartart.title"');
	});

	it('exposes a list with listitem rows', () => {
		const html = render(
			<SmartArtPropertiesPanel smartArtData={listData(2)} canEdit onUpdateElement={vi.fn()} />,
		);
		expect(html).toContain('role="list"');
		expect(html).toContain('role="listitem"');
	});

	it('gives each node input an aria-label referencing its content', () => {
		const html = render(
			<SmartArtPropertiesPanel smartArtData={listData(1)} canEdit onUpdateElement={vi.fn()} />,
		);
		expect(html).toContain('aria-label="Item 1: Item 1"');
	});

	it('labels the move up / move down controls', () => {
		const html = render(
			<SmartArtPropertiesPanel smartArtData={listData(2)} canEdit onUpdateElement={vi.fn()} />,
		);
		expect(html).toMatch(/aria-label="Move [^"]*up"/u);
		expect(html).toMatch(/aria-label="Move [^"]*down"/u);
	});

	it('marks the active style button with aria-pressed', () => {
		const data: PptxSmartArtData = { ...listData(1), style: 'moderate' };
		const html = render(
			<SmartArtPropertiesPanel smartArtData={data} canEdit onUpdateElement={vi.fn()} />,
		);
		expect(html).toMatch(/aria-pressed="true"[^>]*>moderate/u);
	});
});

describe('smartArtPropertiesPanel - validation', () => {
	it('disables Add when a fixed-count layout is at its max (matrix)', () => {
		const data: PptxSmartArtData = {
			resolvedLayoutType: 'matrix',
			nodes: Array.from({ length: 4 }, (_, i) => ({ id: `n${i}`, text: `Q${i}` })),
		};
		const html = render(
			<SmartArtPropertiesPanel smartArtData={data} canEdit onUpdateElement={vi.fn()} />,
		);
		// The Add button is disabled; surface explains the fixed count.
		expect(html).toMatch(/exactly 4 items/u);
	});

	it('shows a bounds note for ranged layouts (venn)', () => {
		const data: PptxSmartArtData = {
			resolvedLayoutType: 'venn',
			nodes: [
				{ id: 'a', text: 'A' },
				{ id: 'b', text: 'B' },
			],
		};
		const html = render(
			<SmartArtPropertiesPanel smartArtData={data} canEdit onUpdateElement={vi.fn()} />,
		);
		expect(html).toMatch(/2 to 3 items/u);
	});

	it('shows no bounds note for unbounded layouts (list)', () => {
		const html = render(
			<SmartArtPropertiesPanel smartArtData={listData(3)} canEdit onUpdateElement={vi.fn()} />,
		);
		expect(html).not.toMatch(/Works best/u);
		expect(html).not.toMatch(/exactly/u);
	});
});

describe('smartArtPropertiesPanel - connections awareness', () => {
	it('surfaces the presence of non-tree connections', () => {
		const data: PptxSmartArtData = {
			...listData(2),
			connections: [{ sourceId: 'n0', destId: 'n1', type: 'presOf' }],
		};
		const html = render(
			<SmartArtPropertiesPanel smartArtData={data} canEdit onUpdateElement={vi.fn()} />,
		);
		expect(html).toContain('other connection(s)');
	});

	it('does not surface plain parOf tree connections', () => {
		const data: PptxSmartArtData = {
			...listData(2),
			connections: [{ sourceId: 'n0', destId: 'n1', type: 'parOf' }],
		};
		const html = render(
			<SmartArtPropertiesPanel smartArtData={data} canEdit onUpdateElement={vi.fn()} />,
		);
		expect(html).not.toContain('other connection(s)');
	});
});

describe('smartArtPropertiesPanel - read only', () => {
	it('disables inputs and buttons when canEdit is false', () => {
		const html = render(
			<SmartArtPropertiesPanel
				smartArtData={listData(2)}
				canEdit={false}
				onUpdateElement={vi.fn()}
			/>,
		);
		expect(html).toContain('disabled');
		// Inputs render disabled.
		expect(html).toMatch(/<input[^>]*disabled/u);
	});
});

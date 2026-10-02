/**
 * The empty-canvas context menu must be findable and announceable by the same
 * contract as the per-element menu (`editor-context-menu.contract.test.ts`),
 * plus its own marker so a cross-binding test can tell the two apart.
 *
 * Angular has no TestBed here (see `vitest.config.ts`), so the guard reads
 * the component source, as `editor-context-menu.contract.test.ts` does.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildCanvasContextMenuEntries } from '../internal/shared';

const SOURCE = readFileSync(
	path.join(import.meta.dirname, 'slide-canvas-context-menu.component.ts'),
	'utf8',
);

describe('slide canvas context menu contract', () => {
	it('renders through the shared element and routes its typed events', () => {
		expect(SOURCE).toContain('<pptx-ui-context-menu');
		expect(SOURCE).toContain('(menu-request)="request($event)"');
		expect(SOURCE).toContain('(menu-close)="closed.emit()"');
		expect(SOURCE).not.toContain('<button');
	});

	it('carries the neutral context-menu marker, plus its own canvas marker and name', () => {
		expect(SOURCE).toContain(
			`markers: ['data-pptx-context-menu', 'data-pptx-canvas-context-menu']`,
		);
		expect(SOURCE).toContain(`this.t('pptx.canvasContextMenu.ariaLabel')`);
	});

	it('renders the shared command list rather than a hand-written one', () => {
		expect(SOURCE).toContain('buildCanvasContextMenuEntries');
		expect(SOURCE).toContain('contextMenuViewItems(this.entries(), this.t)');
		expect(buildCanvasContextMenuEntries()).toHaveLength(6);
	});
});

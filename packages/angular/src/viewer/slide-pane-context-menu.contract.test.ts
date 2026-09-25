/**
 * The thumbnail context menu must be findable and announceable by the same
 * contract as the empty-canvas menu (`slide-canvas-context-menu.contract.test.ts`),
 * plus its own marker so a cross-binding test can tell the two apart.
 *
 * Angular has no TestBed here (see `vitest.config.ts`), so the guard reads
 * the component source.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildSlidePaneContextMenuEntries } from '../internal/shared';

const SOURCE = readFileSync(
	path.join(import.meta.dirname, 'slide-pane-context-menu.component.ts'),
	'utf8',
);

describe('slide pane context menu contract', () => {
	it('carries the neutral context-menu marker, plus its own rail marker', () => {
		expect(SOURCE).toContain('data-pptx-context-menu="true"');
		expect(SOURCE).toContain('data-pptx-slide-pane-context-menu="true"');
	});

	it('declares menu semantics', () => {
		expect(SOURCE).toContain('role="menu"');
	});

	it('roles every command as a menuitem', () => {
		const commands = SOURCE.match(/<button\b/gu)?.length ?? 0;
		const roled = SOURCE.match(/role="menuitem"/gu)?.length ?? 0;
		expect(commands).toBeGreaterThan(0);
		expect(roled).toBe(commands);
	});

	it('renders the shared command list rather than a hand-written one', () => {
		expect(SOURCE).toContain('buildSlidePaneContextMenuEntries');
		expect(SOURCE).toContain('@for (entry of entries(); track entry.id)');
		expect(
			buildSlidePaneContextMenuEntries({
				selectedCount: 1,
				hasHiddenInSelection: false,
				hasVisibleInSelection: true,
				wouldDeleteAllSlides: false,
			}),
		).toHaveLength(6);
	});
});

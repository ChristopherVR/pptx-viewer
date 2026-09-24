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
	it('carries the neutral context-menu marker, plus its own canvas marker', () => {
		expect(SOURCE).toContain('data-pptx-context-menu="true"');
		expect(SOURCE).toContain('data-pptx-canvas-context-menu="true"');
	});

	it('declares menu semantics and a name of its own', () => {
		expect(SOURCE).toContain('role="menu"');
		expect(SOURCE).toContain(`[attr.aria-label]="'pptx.canvasContextMenu.ariaLabel' | translate"`);
	});

	it('roles every command as a menuitem or menuitemcheckbox', () => {
		const commands = SOURCE.match(/<button\b/gu)?.length ?? 0;
		expect(commands).toBeGreaterThan(0);
		expect(SOURCE).toContain(
			`[attr.role]="entry.checked === undefined ? 'menuitem' : 'menuitemcheckbox'"`,
		);
	});

	it('renders the shared command list rather than a hand-written one', () => {
		expect(SOURCE).toContain('buildCanvasContextMenuEntries');
		expect(SOURCE).toContain('@for (entry of entries(); track entry.id)');
		expect(buildCanvasContextMenuEntries()).toHaveLength(6);
	});
});

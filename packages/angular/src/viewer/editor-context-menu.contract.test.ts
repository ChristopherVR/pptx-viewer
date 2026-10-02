/**
 * The context menu must be findable and announceable by the same contract in
 * every binding.
 *
 * The rows are drawn by the shared `pptx-ui-context-menu`; this component only
 * hands it state. Two neutral hooks exist: `role="menu"` (owned by the element)
 * and `data-pptx-context-menu` (set through the state's `markers`).
 * Angular has no TestBed here (see `vitest.config.ts`), so the guard reads
 * the component source, as `element-contract-ownership.test.ts` does.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildContextMenuEntries } from '../internal/shared';

const SOURCE = readFileSync(
	path.join(import.meta.dirname, 'editor-context-menu.component.ts'),
	'utf8',
);

describe('editor context menu contract', () => {
	it('renders through the shared element and routes its typed events', () => {
		expect(SOURCE).toContain('<pptx-ui-context-menu');
		expect(SOURCE).toContain('[state]="view()"');
		expect(SOURCE).toContain('(menu-request)="request($event)"');
		expect(SOURCE).toContain('(menu-close)="closed.emit()"');
		expect(SOURCE).not.toContain('<button');
	});

	it('carries the neutral context-menu marker and a name of its own', () => {
		expect(SOURCE).toContain(`markers: ['data-pptx-context-menu']`);
		expect(SOURCE).toContain(`this.t('pptx.contextMenu.ariaLabel')`);
	});

	it('leaves dismissal and clamping to the shared element', () => {
		expect(SOURCE).not.toContain('HostListener');
		expect(SOURCE).not.toContain('clampedMenuPosition');
	});

	/**
	 * The command COUNT is decided where the list is built: `buildContextMenuEntries`,
	 * which the component must read for any command to render at all.
	 */
	it('renders the shared command list rather than a hand-written one', () => {
		expect(SOURCE).toContain('buildContextMenuEntries');
		expect(SOURCE).toContain('contextMenuViewItems(this.entries(), this.t)');
		expect(buildContextMenuEntries({ elementType: 'shape' }).length).toBeGreaterThan(4);
	});
});

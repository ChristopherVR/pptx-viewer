/**
 * The context menu must be findable and announceable by the same contract in
 * every binding.
 *
 * Two neutral hooks exist: `role="menu"` (what assistive tech reads) and
 * `data-pptx-context-menu="true"` (what a cross-binding test can select on
 * without knowing a single class name). Angular declared the first but not the
 * second, so a parity check had to special-case it. Angular has no TestBed here
 * (see `vitest.config.ts`), so the guard reads the component source, as
 * `element-contract-ownership.test.ts` does.
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
	it('carries the neutral context-menu marker', () => {
		expect(SOURCE).toContain('data-pptx-context-menu="true"');
	});

	it('declares menu semantics and a name of its own', () => {
		expect(SOURCE).toContain('role="menu"');
		expect(SOURCE).toContain(`[attr.aria-label]="'pptx.contextMenu.ariaLabel' | translate"`);
	});

	it('roles every command as a menuitem', () => {
		const commands = SOURCE.match(/<button\b/gu)?.length ?? 0;
		const roled = SOURCE.match(/role="menuitem"/gu)?.length ?? 0;
		expect(commands).toBeGreaterThan(0);
		expect(roled).toBe(commands);
	});

	/**
	 * The command COUNT used to be asserted here (`> 4` buttons in the source),
	 * which only made sense while the items were hand-written. They now come from
	 * the shared list through a single `@for`-rendered button, so the count is
	 * asserted where it is now decided: on `buildContextMenuEntries`, which the
	 * template must be reading from for any command to render at all.
	 */
	it('renders the shared command list rather than a hand-written one', () => {
		expect(SOURCE).toContain('buildContextMenuEntries');
		expect(SOURCE).toContain('@for (entry of entries(); track entry.id)');
		expect(buildContextMenuEntries({ elementType: 'shape' }).length).toBeGreaterThan(4);
	});
});

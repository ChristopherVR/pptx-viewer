/**
 * selection-pane.component.test.ts: guards for the selection pane's inline
 * rename (plus its display helpers).
 *
 * This package has no TestBed (see `vitest.config.ts`), so the interactive
 * wiring is asserted the same way the show-toolbar spec does it: the pure
 * decision logic (`renameCommitName`) is exercised directly, and the static
 * template contract (the e2e data attributes, the rename input's events and
 * accessible name) is read off the component source as text.
 */
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { componentSource } from './component-source.test-support';
import { elementIcon, elementLabel, renameCommitName } from './selection-pane-helpers';

const here = dirname(fileURLToPath(import.meta.url));
const source = componentSource(here, 'selection-pane.component.ts');

function element(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'shape',
		id: 'shape-1',
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		...overrides,
	} as PptxElement;
}

describe('renameCommitName', () => {
	it('commits a trimmed new name', () => {
		expect(renameCommitName('Old', '  New Name  ')).toStrictEqual({ name: 'New Name' });
	});

	it('clears the name when the input is emptied', () => {
		expect(renameCommitName('Old', '')).toStrictEqual({ name: undefined });
		expect(renameCommitName('Old', '   ')).toStrictEqual({ name: undefined });
	});

	it('treats an unedited commit as a no-op, so an id seed is never persisted', () => {
		expect(renameCommitName('shape-1', 'shape-1')).toBeNull();
		expect(renameCommitName('shape-1', '  shape-1  ')).toBeNull();
	});

	it('still renames when only surrounding whitespace differs from the element name', () => {
		// The seed is trimmed for the comparison: typing the same visible name is
		// a no-op even if the input added padding.
		expect(renameCommitName('  Title  ', 'Title')).toBeNull();
	});
});

describe('selection pane display helpers', () => {
	it('labels a row with the authored name, else the id', () => {
		expect(elementLabel(element({ name: 'Hero image' }))).toBe('Hero image');
		expect(elementLabel(element({ name: '   ' }))).toBe('shape-1');
		expect(elementLabel(element())).toBe('shape-1');
	});

	it('falls back to "?" for an unknown element type icon', () => {
		expect(elementIcon('shape')).not.toBe('?');
		expect(elementIcon('somethingNew')).toBe('?');
	});
});

describe('selection pane rename contract (source guards)', () => {
	it('stamps the e2e attributes on the pane root and each row name label', () => {
		expect(source).toContain('data-pptx-selection-pane');
		expect(source).toContain('data-pptx-selection-name');
	});

	it('opens the inline editor on double-click of the name label', () => {
		expect(source).toContain('(dblclick)="startRename(el)"');
	});

	it('renders a plain text input (role textbox) named from the shared i18n key', () => {
		expect(source).toContain('type="text"');
		expect(source).toContain(
			'[attr.aria-label]="\'pptx.selectionPane.renameElement\' | translate"',
		);
	});

	it('commits on Enter and blur, cancels on Escape', () => {
		expect(source).toContain('(keydown.enter)="commitRename(el.id, $event)"');
		expect(source).toContain('(blur)="commitRename(el.id, $event)"');
		expect(source).toContain('(keydown.escape)="cancelRename($event)"');
	});

	it('surfaces the commit as the renameElement output', () => {
		expect(source).toContain('renameElement = output<SelectionPaneRename>()');
	});
});

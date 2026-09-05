import { describe, expect, it } from 'vitest';

import type { ContextMenuCommandId } from './context-menu-commands';
import { buildContextMenuEntries, contextMenuLabelKey } from './context-menu-commands';

function ids(...args: Parameters<typeof buildContextMenuEntries>): ContextMenuCommandId[] {
	return buildContextMenuEntries(...args).map((item) => item.id);
}

describe('buildContextMenuEntries', () => {
	/**
	 * The set every binding must offer on a plain shape. Vue shipped without
	 * Bring to Front / Send to Back / Add Comment, Angular without Edit
	 * Hyperlink, Svelte without either; this is the list that ends that.
	 */
	it('offers clipboard, z-order, comment and hyperlink on a plain shape', () => {
		expect(ids({ elementType: 'shape' })).toStrictEqual([
			'copy',
			'cut',
			'paste',
			'duplicate',
			'bring-forward',
			'send-backward',
			'bring-front',
			'send-back',
			'comment',
			'hyperlink',
			'delete',
		]);
	});

	it('offers Group only on a multi-selection and Ungroup only on a group', () => {
		expect(ids({ elementType: 'shape' })).not.toContain('group');
		expect(ids({ elementType: 'shape' })).not.toContain('ungroup');
		expect(ids({ elementType: 'shape', hasMultiSelection: true })).toContain('group');
		expect(ids({ elementType: 'group' })).toContain('ungroup');
	});

	it('never disables Group when a multi-selection is what opened the menu', () => {
		const group = buildContextMenuEntries({ hasMultiSelection: true }).find(
			(item) => item.id === 'group',
		);
		expect(group?.disabled).toBeUndefined();
	});

	it('disables Group and Ungroup when a:spLocks/a:grpSpLocks reject grouping', () => {
		const group = buildContextMenuEntries({
			hasMultiSelection: true,
			selectionGroupable: false,
		}).find((item) => item.id === 'group');
		expect(group?.disabled).toBeTruthy();

		const ungroup = buildContextMenuEntries({
			elementType: 'group',
			selectionGroupable: false,
		}).find((item) => item.id === 'ungroup');
		expect(ungroup?.disabled).toBeTruthy();
	});

	it('adds the AI entries only when the host configured an assistant', () => {
		expect(ids({})).not.toContain('ai-ask');
		expect(ids({ aiEnabled: true })).toContain('ai-ask');
		expect(ids({ aiEnabled: true })).toContain('ai-fix');
	});

	it('greys out Paste only when the binding says the clipboard is empty', () => {
		const paste = (hasClipboard?: boolean) =>
			buildContextMenuEntries({ hasClipboard }).find((item) => item.id === 'paste');
		expect(paste(false)?.disabled).toBeTruthy();
		expect(paste(true)?.disabled).toBeUndefined();
		expect(paste()?.disabled).toBeUndefined();
	});

	describe('table cells', () => {
		it('adds every row and column command', () => {
			const list = ids({
				elementType: 'table',
				table: { hasMultiCellSelection: false, isMergedCell: false },
			});
			expect(list).toContain('table-insert-row-above');
			expect(list).toContain('table-insert-row-below');
			expect(list).toContain('table-delete-row');
			expect(list).toContain('table-insert-col-left');
			expect(list).toContain('table-insert-col-right');
			expect(list).toContain('table-delete-col');
		});

		it('offers the two pairwise merges on an unspanned single cell', () => {
			const list = ids({
				elementType: 'table',
				table: { hasMultiCellSelection: false, isMergedCell: false },
			});
			expect(list).toContain('table-merge-right');
			expect(list).toContain('table-merge-down');
			expect(list).not.toContain('table-split');
		});

		it('offers a block merge for a multi-cell selection, and split for a span', () => {
			expect(ids({ table: { hasMultiCellSelection: true, isMergedCell: false } })).toContain(
				'table-merge-selected',
			);
			expect(ids({ table: { hasMultiCellSelection: false, isMergedCell: true } })).toContain(
				'table-split',
			);
		});

		it('adds nothing table-shaped when no cell is selected', () => {
			expect(
				ids({ elementType: 'table', table: null }).some((id) => id.startsWith('table-')),
			).toBeFalsy();
		});
	});

	it('separates each group of commands exactly once', () => {
		const entries = buildContextMenuEntries({ elementType: 'shape' });
		// Clipboard | z-order | comment+hyperlink | delete.
		expect(entries.filter((item) => item.separatorBefore)).toHaveLength(3);
		expect(entries[0].separatorBefore).toBeUndefined();
	});

	it('marks Delete as destructive', () => {
		expect(buildContextMenuEntries().find((item) => item.id === 'delete')?.danger).toBeTruthy();
	});

	it('labels every command from the shared dictionary', () => {
		for (const item of buildContextMenuEntries({
			aiEnabled: true,
			hasMultiSelection: true,
			elementType: 'group',
			table: { hasMultiCellSelection: false, isMergedCell: false },
		})) {
			expect(item.labelKey).toBe(contextMenuLabelKey(item.id));
			expect(item.labelKey.startsWith('pptx.')).toBeTruthy();
		}
	});
});

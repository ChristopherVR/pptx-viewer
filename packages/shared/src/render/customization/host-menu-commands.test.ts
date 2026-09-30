import { describe, expect, it, vi } from 'vitest';

import { resolveCustomization } from './customization-resolve';
import {
	customizeCanvasContextMenuEntries,
	customizeContextMenuEntries,
} from './customization-surfaces';

describe('host context-menu commands', () => {
	it('isolates ids, preserves raw labels and groups commands around built-ins', () => {
		const resolved = resolveCustomization({
			contextMenu: {
				extraElementCommands: [
					{ id: 'copy', label: 'Send to chat', onSelect: vi.fn() },
					{ id: 'bottom', label: 'Open details', group: 'bottom', onSelect: vi.fn() },
					{ id: 'copy', label: 'Duplicate id', onSelect: vi.fn() },
				],
			},
		});
		const entries = customizeContextMenuEntries([{ id: 'copy', labelKey: 'copy' }], resolved, {
			slideIndex: 2,
			elementIds: ['shape'],
		});
		expect(entries.map((entry) => entry.id)).toStrictEqual(['host:copy', 'copy', 'host:bottom']);
		expect(entries.map((entry) => Boolean(entry.separatorBefore))).toStrictEqual([
			false,
			true,
			true,
		]);
	});

	it('captures an immutable selection snapshot and evaluates disabled state', () => {
		const run = vi.fn();
		const ids = ['shape'];
		const resolved = resolveCustomization({
			contextMenu: {
				extraElementCommands: [
					{ id: 'run', label: 'Run', onSelect: run },
					{ id: 'locked', label: 'Locked', disabled: (ctx) => ctx.slideIndex === 2, onSelect: run },
				],
			},
		});
		const entries = customizeContextMenuEntries([], resolved, { slideIndex: 2, elementIds: ids });
		ids.push('later');
		for (const entry of entries) {
			if ('host' in entry) {
				entry.onSelect();
			}
		}
		expect(run).toHaveBeenCalledExactlyOnceWith({ slideIndex: 2, elementIds: ['shape'] });
		expect(Object.isFrozen(run.mock.calls[0][0].elementIds)).toBeTruthy();
		expect(entries[1].disabled).toBeTruthy();
	});

	it('offers host-only menus, avoids leading separators and respects disabled menus', () => {
		const run = vi.fn();
		const config = {
			extraCanvasCommands: [{ id: 'run', label: 'Run', group: 'bottom' as const, onSelect: run }],
		};
		const entries = customizeCanvasContextMenuEntries(
			[],
			resolveCustomization({ contextMenu: config }),
			{ slideIndex: 3 },
		);
		expect(entries).toHaveLength(1);
		expect(entries[0].separatorBefore).toBeUndefined();
		if ('host' in entries[0]) {
			entries[0].onSelect();
		}
		expect(run).toHaveBeenCalledExactlyOnceWith({ slideIndex: 3 });
		expect(
			customizeCanvasContextMenuEntries(
				[],
				resolveCustomization({ contextMenu: { ...config, disableCanvasMenu: true } }),
				{ slideIndex: 3 },
			),
		).toStrictEqual([]);
	});
});

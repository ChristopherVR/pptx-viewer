import { describe, expect, it, vi } from 'vitest';

import { TableResizeOverlayComponent } from './table-resize-overlay.component';

describe('table resize release', () => {
	it.each(['col', 'row'] as const)('does not emit for a stationary %s boundary click', (type) => {
		// Exercise the DOM release handler without Angular render scheduling.
		const overlay = Object.create(
			TableResizeOverlayComponent.prototype,
		) as TableResizeOverlayComponent;
		const columns = vi.fn();
		const rows = vi.fn();
		const handle = document.createElement('div');
		Object.assign(overlay, {
			drag: {
				type,
				index: 0,
				startPos: 20,
				handle,
				initialWidths: [0.5, 0.5],
				initialRowHeight: 40,
			},
			onMove: vi.fn(),
			onUp: vi.fn(),
			resizeColumns: { emit: columns },
			resizeRow: { emit: rows },
		});
		overlay['handleUp'](new MouseEvent('pointerup', { clientX: 20, clientY: 20 }) as PointerEvent);
		expect(columns).not.toHaveBeenCalled();
		expect(rows).not.toHaveBeenCalled();
		expect(overlay['drag']).toBeNull();
	});
});

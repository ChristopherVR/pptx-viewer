// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';

import { TableResizeOverlay } from './table-render-resize';

describe('table resize release', () => {
	it.each(['col', 'row'])('does not commit a stationary %s boundary click', (axis) => {
		const host = document.createElement('div');
		document.body.appendChild(host);
		const root = createRoot(host);
		const columns = vi.fn();
		const rows = vi.fn();
		act(() =>
			root.render(
				<TableResizeOverlay
					columnWidths={[0.5, 0.5]}
					editable
					onResizeColumns={columns}
					onResizeRow={rows}
				>
					<table>
						<tbody>
							<tr>
								<td>A</td>
							</tr>
							<tr>
								<td>B</td>
							</tr>
						</tbody>
					</table>
				</TableResizeOverlay>,
			),
		);
		try {
			const handle = host.querySelector<HTMLElement>(`[class*="cursor-${axis}-resize"]`)!;
			act(() => {
				handle.dispatchEvent(
					new MouseEvent('mousedown', { bubbles: true, clientX: 20, clientY: 20 }),
				);
				document.dispatchEvent(new MouseEvent('mouseup', { clientX: 20, clientY: 20 }));
			});
			expect(columns).not.toHaveBeenCalled();
			expect(rows).not.toHaveBeenCalled();
			expect(document.body.style.cursor).toBe('');
		} finally {
			act(() => root.unmount());
			host.remove();
		}
	});
});

import { describe, expect, it, vi } from 'vitest';

import {
	applyChart3DTextStyle,
	registerChart3DTextStyleHandle,
	unregisterChart3DTextStyleHandle,
} from './chart-3d-text-style-registry';

/**
 * `chart-3d-text-style-registry.ts` is the seam presentation playback
 * (`animation-dom.ts`) uses to reach a mounted 3D chart/SmartArt3D scene's own
 * `setTextStyle`, since its axis labels / node captions are canvas-drawn
 * textures no CSS override can target.
 */
describe('chart-3d-text-style-registry', () => {
	it('is a no-op when nothing is registered for the id', () => {
		expect(() => applyChart3DTextStyle(document, 'missing', { bold: true })).not.toThrow();
	});

	it('forwards the style to the registered handle', () => {
		const handle = { setTextStyle: vi.fn() };
		registerChart3DTextStyleHandle(document, 'el-1', handle);
		applyChart3DTextStyle(document, 'el-1', { bold: true });
		expect(handle.setTextStyle).toHaveBeenCalledExactlyOnceWith({ bold: true });
	});

	it('forwards undefined to clear a previously applied style', () => {
		const handle = { setTextStyle: vi.fn() };
		registerChart3DTextStyleHandle(document, 'el-2', handle);
		applyChart3DTextStyle(document, 'el-2', undefined);
		expect(handle.setTextStyle).toHaveBeenCalledExactlyOnceWith(undefined);
	});

	it('a later registration for the same id replaces the earlier handle', () => {
		const first = { setTextStyle: vi.fn() };
		const second = { setTextStyle: vi.fn() };
		registerChart3DTextStyleHandle(document, 'el-3', first);
		registerChart3DTextStyleHandle(document, 'el-3', second);
		applyChart3DTextStyle(document, 'el-3', { italic: true });
		expect(first.setTextStyle).not.toHaveBeenCalled();
		expect(second.setTextStyle).toHaveBeenCalledExactlyOnceWith({ italic: true });
	});

	it('unregister removes the handle so a later apply is a no-op', () => {
		const handle = { setTextStyle: vi.fn() };
		registerChart3DTextStyleHandle(document, 'el-4', handle);
		unregisterChart3DTextStyleHandle(document, 'el-4', handle);
		applyChart3DTextStyle(document, 'el-4', { bold: true });
		expect(handle.setTextStyle).not.toHaveBeenCalled();
	});

	it('unregister is a no-op when a NEWER handle is already registered (stale async disposal)', () => {
		const stale = { setTextStyle: vi.fn() };
		const current = { setTextStyle: vi.fn() };
		registerChart3DTextStyleHandle(document, 'el-5', stale);
		registerChart3DTextStyleHandle(document, 'el-5', current);
		// A stale disposal for the OLD handle must not evict the current one.
		unregisterChart3DTextStyleHandle(document, 'el-5', stale);
		applyChart3DTextStyle(document, 'el-5', { bold: true });
		expect(current.setTextStyle).toHaveBeenCalledExactlyOnceWith({ bold: true });
	});

	it('scopes registrations per document', () => {
		const otherDoc = document.implementation.createHTMLDocument('other');
		const handle = { setTextStyle: vi.fn() };
		registerChart3DTextStyleHandle(document, 'el-6', handle);
		applyChart3DTextStyle(otherDoc, 'el-6', { bold: true });
		expect(handle.setTextStyle).not.toHaveBeenCalled();
	});
});

import { describe, expect, it } from 'vitest';

import { ViewerState } from './viewer-state.svelte';

describe('viewerState', () => {
	it('resets for a loaded deck with a clamped initial slide', () => {
		const state = new ViewerState();
		state.reset(5, 99);
		expect(state.slideCount).toBe(5);
		expect(state.current).toBe(4);
		state.reset(3);
		expect(state.current).toBe(0);
	});

	it('navigates with clamping', () => {
		const state = new ViewerState();
		state.reset(3);
		state.next();
		expect(state.current).toBe(1);
		state.last();
		expect(state.current).toBe(2);
		state.next();
		expect(state.current).toBe(2);
		state.first();
		state.prev();
		expect(state.current).toBe(0);
	});

	it('handles navigation keys and reports handled-ness', () => {
		const state = new ViewerState();
		state.reset(4);
		expect(state.handleNavigationKey('ArrowRight')).toBeTruthy();
		expect(state.current).toBe(1);
		expect(state.handleNavigationKey('End')).toBeTruthy();
		expect(state.current).toBe(3);
		expect(state.handleNavigationKey('Home')).toBeTruthy();
		expect(state.current).toBe(0);
		expect(state.handleNavigationKey('x')).toBeFalsy();
	});

	it('ignores navigation keys before a deck is loaded', () => {
		const state = new ViewerState();
		expect(state.handleNavigationKey('ArrowRight')).toBeFalsy();
	});

	it('zooms from the effective percent and returns to fit', () => {
		const state = new ViewerState();
		expect(state.zoomPercent).toBeNull();
		state.zoomIn(80);
		expect(state.zoomPercent).toBe(100);
		state.zoomIn(100);
		expect(state.zoomPercent).toBe(125);
		state.zoomOut(999);
		expect(state.zoomPercent).toBe(100);
		state.zoomToFit();
		expect(state.zoomPercent).toBeNull();
	});
});

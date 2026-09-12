import { calculateViewportFit } from 'pptx-viewer-shared';
// @vitest-environment happy-dom
/**
 * Tests for pure computation logic extracted from useZoomViewport.
 *
 * We test the math functions (fitScale, zoom clamp, zoom-to-selection
 * bounding-box computation) without mounting React or needing DOM refs.
 */
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
	MIN_ZOOM_SCALE,
	MAX_ZOOM_SCALE,
	MIN_ELEMENT_SIZE,
	ZOOM_TO_SELECTION_PADDING,
} from '../constants';
import { useZoomViewport } from './useZoomViewport';
import type { UseZoomViewportResult } from './useZoomViewport';

describe('useZoomViewport measured fit', () => {
	let root: Root;
	let host: HTMLDivElement;
	let zoom: UseZoomViewportResult;
	let width: number;
	let height: number;
	let resized: () => void;
	let frames: Map<number, FrameRequestCallback>;
	let nextFrame: number;
	const canvasSize = { width: 960, height: 540 };

	function Harness(props: { mounted?: boolean; fitPadding?: number; maxFitScale?: number | null }) {
		zoom = useZoomViewport({ canvasSize, selectedElements: [], ...props });
		return props.mounted === false
			? null
			: createElement('div', {
					ref: (node: HTMLDivElement | null) => {
						zoom.canvasViewportRef.current = node;
						if (node) {
							Object.defineProperty(node, 'clientWidth', { configurable: true, get: () => width });
							Object.defineProperty(node, 'clientHeight', {
								configurable: true,
								get: () => height,
							});
						}
					},
				});
	}

	beforeEach(() => {
		width = 960;
		height = 540;
		frames = new Map();
		nextFrame = 0;
		vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
		vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
			frames.set(++nextFrame, callback);
			return nextFrame;
		});
		vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
		vi.stubGlobal(
			'ResizeObserver',
			class {
				constructor(callback: () => void) {
					resized = callback;
				}
				observe() {}
				disconnect() {}
			},
		);
		host = document.createElement('div');
		document.body.append(host);
		root = createRoot(host);
	});

	afterEach(() => {
		act(() => root.unmount());
		host.remove();
		vi.unstubAllGlobals();
	});

	it('preserves default fit, then reacts to explicit zero padding and unlimited enlargement', () => {
		act(() => root.render(createElement(Harness)));
		expect(zoom.fitScale).toBeCloseTo(508 / 540);
		expect(zoom.editorDimensions).toStrictEqual({ width: 952, height: 508 });
		act(() => root.render(createElement(Harness, { fitPadding: 0, maxFitScale: null })));
		expect(zoom.fitScale).toBe(1);
		width = 1920;
		height = 1080;
		act(() => resized());
		expect(zoom.fitScale).toBe(2);
		act(() => zoom.setScale(1.5));
		expect(zoom.editorScale).toBe(3);
		expect(zoom.renderScaleRef.current).toBe(3);
		const stage = document.createElement('div');
		stage.getBoundingClientRect = () => new DOMRect(100, 200, 2880, 1620);
		zoom.canvasStageRef.current = stage;
		expect(zoom.getCanvasPointFromClient(400, 500)).toStrictEqual({ x: 100, y: 100 });
		act(() => root.render(createElement(Harness, { fitPadding: 0, maxFitScale: 1.25 })));
		expect(zoom.scale).toBe(1.5);
		expect(zoom.editorScale).toBe(1.875);
		expect(zoom.renderScaleRef.current).toBe(1.875);
		act(() => root.render(createElement(Harness)));
		expect(zoom.fitScale).toBe(1);
		expect(zoom.scale).toBe(1.5);
	});

	it('retains the last valid measurement through a temporarily hidden viewport', () => {
		act(() => root.render(createElement(Harness)));
		const previous = zoom.editorDimensions;
		width = 0;
		height = 0;
		act(() => resized());
		expect(zoom.editorDimensions).toBe(previous);
		expect(zoom.fitScale).toBeCloseTo(508 / 540);
	});

	it('measures a viewport mounted after the initial hook render', () => {
		act(() =>
			root.render(createElement(Harness, { mounted: false, fitPadding: 0, maxFitScale: null })),
		);
		expect(zoom.editorDimensions).toBeNull();
		width = 480;
		height = 270;
		act(() =>
			root.render(createElement(Harness, { mounted: true, fitPadding: 0, maxFitScale: null })),
		);
		act(() => {
			const pending = [...frames.values()];
			frames.clear();
			pending.forEach((callback) => callback(0));
		});
		expect(zoom.fitScale).toBe(0.5);
		expect(zoom.renderScaleRef.current).toBe(0.5);
	});
});

// ---------------------------------------------------------------------------
// Extracted pure helpers: mirrors the logic inside the hook
// ---------------------------------------------------------------------------

/** Compute the fit-scale exactly as `useZoomViewport` does in its `useMemo`. */
function computeFitScale(
	editorWidth: number,
	editorHeight: number,
	canvasWidth: number,
	canvasHeight: number,
): number {
	return calculateViewportFit({
		viewportWidth: editorWidth,
		viewportHeight: editorHeight,
		canvasWidth,
		canvasHeight,
		maxFitScale: 1,
	}).scale;
}

/** Clamp a zoom value into [MIN_ZOOM_SCALE, MAX_ZOOM_SCALE]. */
function clampZoom(value: number): number {
	return Math.min(Math.max(value, MIN_ZOOM_SCALE), MAX_ZOOM_SCALE);
}

/** Zoom-in: increment by 0.1 then clamp. */
function zoomIn(current: number): number {
	return Math.min(current + 0.1, MAX_ZOOM_SCALE);
}

/** Zoom-out: decrement by 0.1 then clamp. */
function zoomOut(current: number): number {
	return Math.max(current - 0.1, MIN_ZOOM_SCALE);
}

/** Compute the wheel-zoom delta the same way the hook does. */
function wheelDelta(deltaY: number): number {
	return deltaY * -0.001;
}

interface SelectionBounds {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

interface Element {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** Compute selection bounds from an array of elements. */
function computeSelectionBounds(elements: Element[]): SelectionBounds | null {
	if (elements.length === 0) {
		return null;
	}
	let minX = Number.POSITIVE_INFINITY;
	let minY = Number.POSITIVE_INFINITY;
	let maxX = Number.NEGATIVE_INFINITY;
	let maxY = Number.NEGATIVE_INFINITY;

	elements.forEach((element) => {
		minX = Math.min(minX, element.x);
		minY = Math.min(minY, element.y);
		maxX = Math.max(maxX, element.x + Math.max(element.width, MIN_ELEMENT_SIZE));
		maxY = Math.max(maxY, element.y + Math.max(element.height, MIN_ELEMENT_SIZE));
	});

	if (
		!Number.isFinite(minX) ||
		!Number.isFinite(minY) ||
		!Number.isFinite(maxX) ||
		!Number.isFinite(maxY)
	) {
		return null;
	}
	return { minX, minY, maxX, maxY };
}

/** Compute the target zoom scale for zoom-to-selection. */
function computeZoomToSelectionScale(
	bounds: SelectionBounds,
	editorWidth: number,
	editorHeight: number,
	fitScale: number,
): number {
	const boundsWidth = Math.max(bounds.maxX - bounds.minX, MIN_ELEMENT_SIZE);
	const boundsHeight = Math.max(bounds.maxY - bounds.minY, MIN_ELEMENT_SIZE);
	const availableWidth = Math.max(editorWidth - ZOOM_TO_SELECTION_PADDING, MIN_ELEMENT_SIZE);
	const availableHeight = Math.max(editorHeight - ZOOM_TO_SELECTION_PADDING, MIN_ELEMENT_SIZE);
	const targetEditorScale = Math.min(availableWidth / boundsWidth, availableHeight / boundsHeight);
	const safeFitScale = fitScale > Number.EPSILON ? fitScale : Number.EPSILON;
	return Math.min(Math.max(targetEditorScale / safeFitScale, MIN_ZOOM_SCALE), MAX_ZOOM_SCALE);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useZoomViewport: pure logic', () => {
	// ── computeFitScale ───────────────────────────────────────────────
	describe('computeFitScale', () => {
		it('should return 1 when editor equals canvas size', () => {
			expect(computeFitScale(1280, 720, 1280, 720)).toBe(1);
		});

		it('should return 1 when editor is larger than canvas', () => {
			// capped at 1 by Math.min(..., 1)
			expect(computeFitScale(2560, 1440, 1280, 720)).toBe(1);
		});

		it('should scale down when editor is narrower', () => {
			const result = computeFitScale(640, 720, 1280, 720);
			expect(result).toBeCloseTo(0.5, 5);
		});

		it('should scale down when editor is shorter', () => {
			const result = computeFitScale(1280, 360, 1280, 720);
			expect(result).toBeCloseTo(0.5, 5);
		});

		it('should return the smaller of width/height ratios', () => {
			const result = computeFitScale(640, 180, 1280, 720);
			// widthScale = 0.5, heightScale = 0.25 => min is 0.25
			expect(result).toBeCloseTo(0.25, 5);
		});

		it('should return 1 when dimensions are zero', () => {
			expect(computeFitScale(0, 0, 1280, 720)).toBe(1);
		});
	});

	// ── clampZoom ─────────────────────────────────────────────────────
	describe('clampZoom', () => {
		it('should clamp below minimum', () => {
			expect(clampZoom(0.01)).toBe(MIN_ZOOM_SCALE);
		});

		it('should clamp above maximum', () => {
			expect(clampZoom(100)).toBe(MAX_ZOOM_SCALE);
		});

		it('should pass through values in range', () => {
			expect(clampZoom(1.5)).toBe(1.5);
		});

		it('should accept exact boundaries', () => {
			expect(clampZoom(MIN_ZOOM_SCALE)).toBe(MIN_ZOOM_SCALE);
			expect(clampZoom(MAX_ZOOM_SCALE)).toBe(MAX_ZOOM_SCALE);
		});
	});

	// ── zoomIn / zoomOut ──────────────────────────────────────────────
	describe('zoomIn / zoomOut', () => {
		it('zoomIn should increment by 0.1', () => {
			expect(zoomIn(1)).toBeCloseTo(1.1, 5);
		});

		it('zoomIn should not exceed MAX_ZOOM_SCALE', () => {
			expect(zoomIn(MAX_ZOOM_SCALE)).toBe(MAX_ZOOM_SCALE);
		});

		it('zoomOut should decrement by 0.1', () => {
			expect(zoomOut(1)).toBeCloseTo(0.9, 5);
		});

		it('zoomOut should not go below MIN_ZOOM_SCALE', () => {
			expect(zoomOut(MIN_ZOOM_SCALE)).toBe(MIN_ZOOM_SCALE);
		});
	});

	// ── wheelDelta ────────────────────────────────────────────────────
	describe('wheelDelta', () => {
		it('should invert and scale deltaY', () => {
			expect(wheelDelta(100)).toBeCloseTo(-0.1, 5);
		});

		it('should return positive delta for negative scroll', () => {
			expect(wheelDelta(-200)).toBeCloseTo(0.2, 5);
		});

		it('should return 0 for 0 delta', () => {
			expect(wheelDelta(0)).toBeCloseTo(0, 10);
		});
	});

	// ── computeSelectionBounds ────────────────────────────────────────
	describe('computeSelectionBounds', () => {
		it('should return null for empty array', () => {
			expect(computeSelectionBounds([])).toBeNull();
		});

		it('should compute bounds for a single element', () => {
			const bounds = computeSelectionBounds([{ x: 10, y: 20, width: 100, height: 50 }]);
			expect(bounds).toStrictEqual({ minX: 10, minY: 20, maxX: 110, maxY: 70 });
		});

		it('should compute bounds for multiple elements', () => {
			const bounds = computeSelectionBounds([
				{ x: 10, y: 20, width: 100, height: 50 },
				{ x: 200, y: 300, width: 50, height: 60 },
			]);
			expect(bounds).toStrictEqual({ minX: 10, minY: 20, maxX: 250, maxY: 360 });
		});

		it('should enforce MIN_ELEMENT_SIZE on width/height', () => {
			const bounds = computeSelectionBounds([{ x: 10, y: 20, width: 0, height: 0 }]);
			expect(bounds).toStrictEqual({
				minX: 10,
				minY: 20,
				maxX: 10 + MIN_ELEMENT_SIZE,
				maxY: 20 + MIN_ELEMENT_SIZE,
			});
		});
	});

	// ── computeZoomToSelectionScale ───────────────────────────────────
	describe('computeZoomToSelectionScale', () => {
		it('should compute a scale that fits the selection in the editor', () => {
			const bounds = { minX: 0, minY: 0, maxX: 200, maxY: 100 };
			const editorWidth = 1280;
			const editorHeight = 720;
			const fitScale = 1;
			const result = computeZoomToSelectionScale(bounds, editorWidth, editorHeight, fitScale);
			// availableWidth = 1280 - 96 = 1184, availableHeight = 720 - 96 = 624
			// widthRatio = 1184 / 200 = 5.92, heightRatio = 624 / 100 = 6.24
			// target = min(5.92, 6.24) = 5.92, clamped by MAX_ZOOM_SCALE = 5
			expect(result).toBe(MAX_ZOOM_SCALE);
		});

		it('should not go below MIN_ZOOM_SCALE', () => {
			// Very large selection relative to editor
			const bounds = { minX: 0, minY: 0, maxX: 100000, maxY: 100000 };
			const result = computeZoomToSelectionScale(bounds, 200, 200, 1);
			expect(result).toBe(MIN_ZOOM_SCALE);
		});

		it('should handle very small fitScale gracefully', () => {
			const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
			const result = computeZoomToSelectionScale(bounds, 800, 600, 0);
			// safeFitScale = Number.EPSILON, so result will be huge => clamped
			expect(result).toBe(MAX_ZOOM_SCALE);
		});

		it('should scale proportionally with fitScale', () => {
			const bounds = { minX: 0, minY: 0, maxX: 500, maxY: 500 };
			const result1 = computeZoomToSelectionScale(bounds, 800, 800, 1);
			const result2 = computeZoomToSelectionScale(bounds, 800, 800, 0.5);
			// With half the fitScale, the user-level scale doubles
			expect(result2).toBeGreaterThan(result1);
		});
	});
});

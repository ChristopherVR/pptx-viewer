import type { PptxElement } from 'pptx-viewer-core';
import { clampZoomScale, createViewerZoomStore } from 'pptx-viewer-shared';
import type { ViewerZoomState, ViewerZoomStore } from 'pptx-viewer-shared';
import { useRef, useState, useMemo, useCallback, useEffect } from 'react';

import { MIN_ELEMENT_SIZE, ZOOM_TO_SELECTION_PADDING } from '../constants';
import type { CanvasSize } from '../types';
import { useViewerStore } from './useViewerStore';

/** Module scope so the selector identity is stable across renders. */
const selectZoom = (state: ViewerZoomState): number => state.zoom;

/** Axis-aligned bounding box used by zoom / viewport helpers. */
interface SelectionBounds {
	minX: number;
	minY: number;
	maxX: number;
	maxY: number;
}

interface UseZoomViewportInput {
	canvasSize: CanvasSize;
	selectedElements: PptxElement[];
}

export interface UseZoomViewportResult {
	// Refs
	editWrapperRef: React.RefObject<HTMLDivElement | null>;
	canvasStageRef: React.RefObject<HTMLDivElement | null>;
	canvasViewportRef: React.RefObject<HTMLDivElement | null>;
	renderScaleRef: React.MutableRefObject<number>;
	// State
	scale: number;
	setScale: (scale: number) => void;
	editorDimensions: CanvasSize | null;
	setEditorDimensions: (dims: CanvasSize | null) => void;
	// Derived
	fitScale: number;
	editorScale: number;
	// Actions
	handleZoomIn: () => void;
	handleZoomOut: () => void;
	handleResetZoom: () => void;
	handleZoomToFit: () => void;
	handleZoomToSelection: () => void;
	handleWheel: (e: WheelEvent) => void;
	centerBoundsInViewport: (bounds: SelectionBounds, nextScale: number) => void;
	getCanvasPointFromClient: (clientX: number, clientY: number) => { x: number; y: number } | null;
}

export function useZoomViewport({
	canvasSize,
	selectedElements,
}: UseZoomViewportInput): UseZoomViewportResult {
	// ── Refs ──────────────────────────────────────────────────────────────
	const editWrapperRef = useRef<HTMLDivElement>(null);
	const canvasStageRef = useRef<HTMLDivElement>(null);
	const canvasViewportRef = useRef<HTMLDivElement>(null);
	const renderScaleRef = useRef(1);

	// ── State ─────────────────────────────────────────────────────────────
	// The user's zoom factor lives in the shared zoom store, so the zoom MODEL
	// (not merely the step size) is one definition across all five bindings.
	// Reading it through a selector subscription also means this hook re-renders
	// for a zoom change and not for anything else in the store (issue #145).
	const storeRef = useRef<ViewerZoomStore | null>(null);
	storeRef.current ??= createViewerZoomStore();
	const store = storeRef.current;
	const scale = useViewerStore(store, selectZoom);
	const setScale = useCallback(
		(next: number) => store.dispatch({ type: 'set-zoom', zoom: next }),
		[store],
	);
	const [editorDimensions, setEditorDimensions] = useState<CanvasSize | null>(null);

	// ── Derived ───────────────────────────────────────────────────────────
	const effectiveEditorDimensions = editorDimensions || {
		width: canvasSize.width,
		height: canvasSize.height,
	};

	const fitScale = useMemo(() => {
		if (!effectiveEditorDimensions.width || !effectiveEditorDimensions.height) {
			return 1;
		}
		const widthScale = effectiveEditorDimensions.width / canvasSize.width;
		const heightScale = effectiveEditorDimensions.height / canvasSize.height;
		return Math.min(widthScale, heightScale, 1);
	}, [canvasSize, effectiveEditorDimensions.height, effectiveEditorDimensions.width]);

	const editorScale = fitScale * scale;

	// Keep the mutable ref in sync so imperative code has the latest value.
	useEffect(() => {
		renderScaleRef.current = editorScale;
	}, [editorScale]);

	// Publish the measured viewport fit into the store, so consumers can select
	// the effective on-screen scale from one place. A repeated measurement is
	// dropped by the reducer, so a ResizeObserver settling costs nothing.
	useEffect(() => {
		store.dispatch({ type: 'set-fit-scale', fitScale });
	}, [store, fitScale]);

	// Measure the available editor area (the scrollable canvas viewport) so
	// `fitScale` reflects reality and the slide is fit-to-contain by default.
	// Without this, editorDimensions stays null → fitScale is pinned at 1 and
	// the slide renders at native size, overflowing small (esp. mobile) viewports.
	// The slide is centred with an `my-4` margin and an optional ruler gutter, so
	// we trim a small allowance off the measured box.
	useEffect(() => {
		let observer: ResizeObserver | null = null;
		let raf = 0;
		const VERTICAL_MARGIN = 32; // editWrapper `my-4` (top + bottom)
		const measure = (el: HTMLElement) => {
			const width = Math.max(0, el.clientWidth - 8);
			const height = Math.max(0, el.clientHeight - VERTICAL_MARGIN);
			if (width > 0 && height > 0) {
				setEditorDimensions({ width, height });
			}
		};
		const attach = () => {
			const el = canvasViewportRef.current;
			if (!el) {
				raf = requestAnimationFrame(attach);
				return;
			}
			observer = new ResizeObserver(() => measure(el));
			observer.observe(el);
			measure(el);
		};
		attach();
		return () => {
			cancelAnimationFrame(raf);
			observer?.disconnect();
		};
	}, []);

	// ── Actions ───────────────────────────────────────────────────────────

	const centerBoundsInViewport = useCallback(
		(bounds: SelectionBounds, nextScale: number) => {
			const wrapper = editWrapperRef.current;
			const canvasViewport = canvasViewportRef.current;
			if (!wrapper || !canvasViewport) {
				return;
			}

			const boundedScale = clampZoomScale(nextScale);
			const nextEditorScale = fitScale * boundedScale;
			const centerX = (bounds.minX + bounds.maxX) / 2;
			const centerY = (bounds.minY + bounds.maxY) / 2;
			const targetScrollLeft =
				canvasViewport.offsetLeft + centerX * nextEditorScale - wrapper.clientWidth / 2;
			const targetScrollTop =
				canvasViewport.offsetTop + centerY * nextEditorScale - wrapper.clientHeight / 2;

			wrapper.scrollTo({
				left: Math.max(targetScrollLeft, 0),
				top: Math.max(targetScrollTop, 0),
				behavior: 'smooth',
			});
		},
		[fitScale],
	);

	// The step itself lives in pptx-viewer-shared so all five bindings move the
	// stage by the same amount per press (two of them stepped by 1.25x instead).
	const handleZoomIn = useCallback(() => {
		store.dispatch({ type: 'zoom-in' });
	}, [store]);

	const handleZoomOut = useCallback(() => {
		store.dispatch({ type: 'zoom-out' });
	}, [store]);

	const handleResetZoom = useCallback(() => {
		store.dispatch({ type: 'zoom-to-fit' });
	}, [store]);

	const handleZoomToFit = useCallback(() => {
		store.dispatch({ type: 'zoom-to-fit' });
	}, [store]);

	const handleZoomToSelection = useCallback(() => {
		if (selectedElements.length === 0) {
			return;
		}

		let minX = Number.POSITIVE_INFINITY;
		let minY = Number.POSITIVE_INFINITY;
		let maxX = Number.NEGATIVE_INFINITY;
		let maxY = Number.NEGATIVE_INFINITY;

		selectedElements.forEach((element) => {
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
			return;
		}

		const selectionBounds: SelectionBounds = { minX, minY, maxX, maxY };

		const boundsWidth = Math.max(selectionBounds.maxX - selectionBounds.minX, MIN_ELEMENT_SIZE);
		const boundsHeight = Math.max(selectionBounds.maxY - selectionBounds.minY, MIN_ELEMENT_SIZE);
		const availableWidth = Math.max(
			effectiveEditorDimensions.width - ZOOM_TO_SELECTION_PADDING,
			MIN_ELEMENT_SIZE,
		);
		const availableHeight = Math.max(
			effectiveEditorDimensions.height - ZOOM_TO_SELECTION_PADDING,
			MIN_ELEMENT_SIZE,
		);
		const targetEditorScale = Math.min(
			availableWidth / boundsWidth,
			availableHeight / boundsHeight,
		);
		const safeFitScale = fitScale > Number.EPSILON ? fitScale : Number.EPSILON;
		const nextScale = clampZoomScale(targetEditorScale / safeFitScale);

		setScale(nextScale);

		window.requestAnimationFrame(() => {
			window.requestAnimationFrame(() => {
				centerBoundsInViewport(selectionBounds, nextScale);
			});
		});
	}, [
		centerBoundsInViewport,
		effectiveEditorDimensions.height,
		effectiveEditorDimensions.width,
		fitScale,
		selectedElements,
		setScale,
	]);

	const handleWheel = useCallback(
		(event: WheelEvent) => {
			if (!event.ctrlKey) {
				return;
			}
			event.preventDefault();
			const delta = event.deltaY * -0.001;
			// Read the live value from the store rather than closing over `scale`:
			// wheel events arrive faster than React commits, so a captured value
			// would quantise the gesture to the last rendered scale.
			store.dispatch({
				type: 'set-zoom',
				zoom: clampZoomScale(store.getState().zoom + delta),
			});
		},
		[store],
	);

	// Attach the wheel listener natively with { passive: false } so that
	// preventDefault() works. React's onWheel is passive since React 17+.
	//
	// The viewport does not exist on the viewer's first commit (with no deck
	// loaded `SlideCanvas` is unmounted), and `handleWheel` is stable because
	// `store` is a ref, so a plain effect ran ONCE against a null ref and never
	// re-ran: the listener was never attached at all and Ctrl+wheel zoom was
	// dead. Retry on an animation frame until the node exists, exactly as the
	// ResizeObserver above does.
	useEffect(() => {
		let raf = 0;
		let attached: HTMLDivElement | null = null;
		const attach = (): void => {
			const viewport = canvasViewportRef.current;
			if (!viewport) {
				raf = requestAnimationFrame(attach);
				return;
			}
			attached = viewport;
			viewport.addEventListener('wheel', handleWheel, { passive: false });
		};
		attach();
		return () => {
			cancelAnimationFrame(raf);
			attached?.removeEventListener('wheel', handleWheel);
		};
	}, [handleWheel]);

	const getCanvasPointFromClient = useCallback(
		(clientX: number, clientY: number): { x: number; y: number } | null => {
			const canvasStage = canvasStageRef.current;
			if (!canvasStage) {
				return null;
			}

			const rect = canvasStage.getBoundingClientRect();
			if (rect.width <= 0 || rect.height <= 0) {
				return null;
			}
			const x = (clientX - rect.left) / editorScale;
			const y = (clientY - rect.top) / editorScale;
			return {
				x: Math.max(0, Math.min(canvasSize.width, x)),
				y: Math.max(0, Math.min(canvasSize.height, y)),
			};
		},
		[canvasSize.height, canvasSize.width, editorScale],
	);

	// ── Return ────────────────────────────────────────────────────────────
	return {
		editWrapperRef,
		canvasStageRef,
		canvasViewportRef,
		renderScaleRef,
		scale,
		setScale,
		editorDimensions,
		setEditorDimensions,
		fitScale,
		editorScale,
		handleZoomIn,
		handleZoomOut,
		handleResetZoom,
		handleZoomToFit,
		handleZoomToSelection,
		handleWheel,
		centerBoundsInViewport,
		getCanvasPointFromClient,
	};
}

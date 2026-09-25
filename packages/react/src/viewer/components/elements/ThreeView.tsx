/**
 * Thin React wrapper around `<pptx-three-view>`, the shared custom element
 * that hosts every three.js scene (3D chart, 3D SmartArt) through one WebGL
 * context (see `packages/shared/src/three-view/`). This is the only place in
 * the React binding that touches the element directly: it registers it,
 * sets its object-valued properties imperatively (a custom element only
 * reflects string/boolean attributes through JSX, never plain objects),
 * forwards its `pptx-three-*` events, and slots the caller's 2D render as
 * the element's fallback child.
 *
 * Registering at module scope (rather than inside an effect) matters: on the
 * very first mount, a `useLayoutEffect` that sets `.spec` would otherwise run
 * BEFORE a sibling `useEffect` that calls `defineThreeViewElement()` (layout
 * effects run before passive effects within the same commit), so the
 * property would land on a not-yet-upgraded element and be dropped. Module
 * evaluation always runs before the first render.
 *
 * @module ThreeView
 */
import { defineThreeViewElement } from 'pptx-viewer-shared';
import type {
	ChartPartRef,
	PptxThreeViewElement,
	TextStyleAnimationDescriptor,
	ThreeViewDragDetail,
	ThreeViewSpec,
	ThreeViewState,
} from 'pptx-viewer-shared';
import React, { useCallback, useLayoutEffect, useRef } from 'react';

defineThreeViewElement();

export interface ThreeViewProps {
	/** The scene to mount, or `null` to show only the slotted 2D fallback. */
	spec: ThreeViewSpec | null;
	/** Whether pointer interaction (select, drag) is enabled. Defaults to `true`. */
	interactive?: boolean;
	/** Mirrors an externally chosen chart part (e.g. picked in the inspector) onto the scene. */
	selectedPart?: ChartPartRef | null;
	/** Active font-style emphasis override (animation playback), applied to the scene's text. */
	textStyle?: TextStyleAnimationDescriptor;
	className?: string;
	style?: React.CSSProperties;
	/** A chart mark was clicked (or empty space was, clearing selection). */
	onSelect?: (part: ChartPartRef | null) => void;
	/** A chart mark's value is being dragged (`move`) or the drag just committed (`commit`). */
	onDrag?: (detail: ThreeViewDragDetail) => void;
	/** The view's lifecycle state changed (idle/loading/ready/unavailable/error). */
	onStateChange?: (state: ThreeViewState) => void;
	/** The 2D SVG render: shown while the scene loads, and again as its fallback on failure. */
	children?: React.ReactNode;
}

function useThreeViewEvent<T>(
	ref: React.RefObject<PptxThreeViewElement | null>,
	type: string,
	handler: (detail: T) => void,
): void {
	// A custom element's events are plain DOM CustomEvents, not one of React's
	// synthetic event types, so a JSX `onXxx` prop never fires for them; both
	// React 18 and 19 need a native listener.
	useLayoutEffect(() => {
		const host = ref.current;
		if (!host) {
			return undefined;
		}
		const listener = (event: Event): void => handler((event as CustomEvent<T>).detail);
		host.addEventListener(type, listener);
		return () => host.removeEventListener(type, listener);
	}, [ref, type, handler]);
}

/**
 * Mounts `<pptx-three-view>`. `spec` should be a memoised object (see
 * `resolveChartThreeViewSpec`/`resolveSmartArtThreeViewSpec` in
 * `pptx-viewer-shared`): the same element data yields the same spec object,
 * so an unrelated re-render never remounts the scene.
 */
export function ThreeView({
	spec,
	interactive = true,
	selectedPart = null,
	textStyle,
	className,
	style,
	onSelect,
	onDrag,
	onStateChange,
	children,
}: ThreeViewProps): React.ReactElement {
	const ref = useRef<PptxThreeViewElement>(null);

	useLayoutEffect(() => {
		if (ref.current) {
			ref.current.spec = spec;
		}
	}, [spec]);
	useLayoutEffect(() => {
		if (ref.current) {
			ref.current.interactive = interactive;
		}
	}, [interactive]);
	useLayoutEffect(() => {
		if (ref.current) {
			ref.current.selectedPart = selectedPart;
		}
	}, [selectedPart]);
	useLayoutEffect(() => {
		if (ref.current) {
			ref.current.textStyle = textStyle;
		}
	}, [textStyle]);

	const handleSelectEvent = useCallback(
		(detail: { part: ChartPartRef | null }) => onSelect?.(detail.part),
		[onSelect],
	);
	const handleDragEvent = useCallback((detail: ThreeViewDragDetail) => onDrag?.(detail), [onDrag]);
	const handleStateEvent = useCallback(
		(detail: { state: ThreeViewState }) => onStateChange?.(detail.state),
		[onStateChange],
	);
	useThreeViewEvent(ref, 'pptx-three-select', handleSelectEvent);
	useThreeViewEvent(ref, 'pptx-three-drag', handleDragEvent);
	useThreeViewEvent(ref, 'pptx-three-state', handleStateEvent);

	return (
		<pptx-three-view ref={ref} className={className} style={style}>
			{children}
		</pptx-three-view>
	);
}

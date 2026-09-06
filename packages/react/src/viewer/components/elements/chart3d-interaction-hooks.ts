/**
 * Small React-only plumbing shared by every interactive 3D chart scene
 * (Bar3DChartScene, Line3DChartScene, Area3DChartScene, SurfaceChart3DScene,
 * PieChart3DScene): a stable-identity interaction bag (so passing a fresh
 * inline `{ onSelect, ... }` object from a parent render does not re-run the
 * scene's mount effect, which is keyed on this reference) and a plain
 * "latest value" ref (so an async `mount*Chart3D(...).then(...)` callback can
 * read the CURRENT prop value instead of whatever was in scope when the
 * effect ran).
 *
 * This is deliberately kept out of `pptx-viewer-shared`: it is `useRef`/
 * `useCallback` plumbing with no framework-agnostic decision inside it, not
 * logic the other four bindings would ever port.
 *
 * @module chart3d-interaction-hooks
 */

import type { ChartPartRef } from 'pptx-viewer-shared';
import { useCallback, useMemo, useRef } from 'react';
import type { RefObject } from 'react';

/**
 * Superset of every 3D chart scene's interaction shape
 * (`BarChart3DInteraction` / `CartesianChart3DInteraction` /
 * `PieChart3DInteraction` carry all three; `SurfaceChart3DInteraction` also
 * carries all three, for its own vertex drag). A caller passes a variable of
 * this type into a `mount*Chart3D` parameter typed to one of the narrower
 * interfaces; TypeScript's structural assignability allows the extra
 * optional members.
 */
export interface AnyChart3DInteraction {
	onSelect?: (part: ChartPartRef | null) => void;
	onValueDragPreview?: (part: ChartPartRef, value: number) => void;
	onValueDragCommit?: (part: ChartPartRef, value: number) => void;
}

/**
 * Wraps a possibly-unstable interaction bag (a fresh object identity every
 * render, since callers typically build it inline from render-scoped
 * closures) into a value with a permanently STABLE identity, backed by a ref
 * updated on every render. Pass the result to a scene's mount effect so the
 * effect's dependency array does not see a change (and remount the whole
 * WebGL scene) merely because the parent re-rendered.
 */
export function useStableChart3DInteraction(
	interaction: AnyChart3DInteraction | undefined,
): Required<AnyChart3DInteraction> {
	const ref = useRef(interaction);
	ref.current = interaction;

	const onSelect = useCallback((part: ChartPartRef | null) => {
		ref.current?.onSelect?.(part);
	}, []);
	const onValueDragPreview = useCallback((part: ChartPartRef, value: number) => {
		ref.current?.onValueDragPreview?.(part, value);
	}, []);
	const onValueDragCommit = useCallback((part: ChartPartRef, value: number) => {
		ref.current?.onValueDragCommit?.(part, value);
	}, []);

	// Every dependency is itself referentially stable (empty-deps
	// useCallback), so this object is created once and never changes again.
	return useMemo(
		() => ({ onSelect, onValueDragPreview, onValueDragCommit }),
		[onSelect, onValueDragPreview, onValueDragCommit],
	);
}

/** A ref that always holds the most recently rendered value of `value`. */
export function useLatestRef<T>(value: T): RefObject<T> {
	const ref = useRef(value);
	ref.current = value;
	return ref;
}

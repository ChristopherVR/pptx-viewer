/**
 * Inner Three.js scene component for the interactive surface-chart view.
 *
 * Lazy-loaded by {@link SurfaceChart3DRenderer} so the shared vanilla-three
 * controller (and `three` itself) is never bundled when the consumer does not
 * install the optional `three` peer dependency.
 *
 * Mounts the framework-agnostic {@link mountSurfaceChart3D} controller from
 * `pptx-viewer-shared` into a container `<div>` via an effect, and disposes it
 * on unmount or when the chart data changes. No `@react-three/*` dependencies.
 *
 * @module SurfaceChart3DScene
 */

import type {
	ChartPartRef,
	SurfaceChart3DHandle,
	SurfaceChart3DSceneOptions,
	TextStyleAnimationDescriptor,
} from 'pptx-viewer-shared';
import { mountSurfaceChart3D } from 'pptx-viewer-shared';
import React, { useEffect, useRef } from 'react';

import type { AnyChart3DInteraction } from './chart3d-interaction-hooks';
import { useLatestRef, useStableChart3DInteraction } from './chart3d-interaction-hooks';

export interface SurfaceChart3DSceneProps {
	options: SurfaceChart3DSceneOptions;
	/** Click-to-select + drag-to-value wiring; omit for a read-only mount. */
	interaction?: AnyChart3DInteraction;
	/** External selection (e.g. from the inspector) to mirror onto this scene. */
	selectedPart?: ChartPartRef | null;
	/** Active font-style emphasis override for the axis labels. */
	textStyle?: TextStyleAnimationDescriptor;
}

export default function SurfaceChart3DScene({
	options,
	interaction,
	selectedPart = null,
	textStyle,
}: SurfaceChart3DSceneProps): React.ReactElement {
	const containerRef = useRef<HTMLDivElement>(null);
	const handleRef = useRef<SurfaceChart3DHandle | null>(null);
	const stableInteraction = useStableChart3DInteraction(interaction);
	const selectedPartRef = useLatestRef(selectedPart);
	const textStyleRef = useLatestRef(textStyle);

	// Mount once per data identity; rebuild the whole scene when the grid
	// changes. Size changes alone are pushed to the live handle below.
	useEffect(() => {
		const container = containerRef.current;
		if (!container) {
			return;
		}
		let disposed = false;
		void mountSurfaceChart3D(container, options, stableInteraction).then((handle) => {
			if (disposed) {
				handle.dispose();
			} else {
				handleRef.current = handle;
				handle.setSelectedPart(selectedPartRef.current);
				handle.setTextStyle(textStyleRef.current);
			}
			return undefined;
		});
		return () => {
			disposed = true;
			handleRef.current?.dispose();
			handleRef.current = null;
		};
		// Intentionally keyed on `options`/`stableInteraction` only (the latter is
		// stable for the scene's lifetime); width/height are pushed to the live
		// handle by the effect below to avoid a costly scene remount on resize.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [options, stableInteraction]);

	// Apply size changes to the live handle without remounting.
	useEffect(() => {
		handleRef.current?.resize(options.width, options.height);
	}, [options.width, options.height]);

	useEffect(() => {
		handleRef.current?.setSelectedPart(selectedPart);
	}, [selectedPart]);

	useEffect(() => {
		handleRef.current?.setTextStyle(textStyle);
	}, [textStyle]);

	return (
		<div
			ref={containerRef}
			style={{
				width: options.width,
				height: options.height,
				willChange: 'transform',
			}}
		/>
	);
}

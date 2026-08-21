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

import type { SurfaceChart3DHandle, SurfaceChart3DSceneOptions } from 'pptx-viewer-shared';
import { mountSurfaceChart3D } from 'pptx-viewer-shared';
import React, { useEffect, useRef } from 'react';

export interface SurfaceChart3DSceneProps {
	options: SurfaceChart3DSceneOptions;
}

export default function SurfaceChart3DScene({
	options,
}: SurfaceChart3DSceneProps): React.ReactElement {
	const containerRef = useRef<HTMLDivElement>(null);
	const handleRef = useRef<SurfaceChart3DHandle | null>(null);

	// Mount once per data identity; rebuild the whole scene when the grid
	// changes. Size changes alone are pushed to the live handle below.
	useEffect(() => {
		const container = containerRef.current;
		if (!container) {
			return;
		}
		let disposed = false;
		void mountSurfaceChart3D(container, options).then((handle) => {
			if (disposed) {
				handle.dispose();
			} else {
				handleRef.current = handle;
			}
			return undefined;
		});
		return () => {
			disposed = true;
			handleRef.current?.dispose();
			handleRef.current = null;
		};
		// Intentionally keyed on `options` only (its reference changes whenever the
		// underlying chart data does); width/height are pushed to the live handle
		// by the effect below to avoid a costly scene remount on every resize.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [options]);

	// Apply size changes to the live handle without remounting.
	useEffect(() => {
		handleRef.current?.resize(options.width, options.height);
	}, [options.width, options.height]);

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

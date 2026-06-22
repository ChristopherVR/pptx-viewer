/**
 * Inner Three.js scene wrapper for rendering 3D surface charts.
 *
 * Lazy-loaded by {@link SurfaceChart3D} so that Three.js is never bundled when
 * the consumer does not install the optional `three` peer dependency.
 *
 * It mounts the framework-agnostic {@link mountSurfaceChart3D} controller from
 * `pptx-viewer-shared` into a container `<div>` via an effect, and disposes it
 * on unmount or when its inputs change. The controller builds the surface mesh,
 * lights, camera, OrbitControls, and DOM-overlay axis labels; this wrapper only
 * adds the optional chart-title overlay. No `@react-three/*` dependencies.
 *
 * @module SurfaceChart3DScene
 */

import { mountSurfaceChart3D } from 'pptx-viewer-shared';
import type { SurfaceChart3DHandle } from 'pptx-viewer-shared';
import React, { useRef, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SurfaceChart3DSceneProps {
	/** Number of data categories (X axis points). */
	cols: number;
	/** Number of data series (Z axis points). */
	rows: number;
	/**
	 * Normalised height values as a flat row-major array of length rows * cols.
	 * Each value is in [0, 1].
	 */
	heightMap: Float32Array;
	/**
	 * RGB colour values as a flat array of length rows * cols * 3.
	 * Each triplet is [r, g, b] in [0, 1].
	 */
	colorMap: Float32Array;
	/** Whether to show wireframe grid lines on the surface. */
	wireframe: boolean;
	/** Category labels for the X axis. */
	categoryLabels: ReadonlyArray<string>;
	/** Series names for the Z axis. */
	seriesNames: ReadonlyArray<string>;
	/** Chart title (optional). */
	title?: string;
	/** Container width in pixels. */
	width: number;
	/** Container height in pixels. */
	height: number;
}

// ---------------------------------------------------------------------------
// Main exported scene
// ---------------------------------------------------------------------------

export default function SurfaceChart3DScene({
	cols,
	rows,
	heightMap,
	colorMap,
	wireframe,
	categoryLabels,
	seriesNames,
	title,
	width,
	height,
}: SurfaceChart3DSceneProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const handleRef = useRef<SurfaceChart3DHandle | null>(null);

	// Mount the shared controller for the current surface data. Recreated when
	// the data/geometry changes; pure size changes are pushed to the live handle
	// by the resize effect below to avoid a costly scene remount.
	useEffect(() => {
		const container = containerRef.current;
		if (!container) {
			return;
		}
		let disposed = false;
		void mountSurfaceChart3D(container, {
			cols,
			rows,
			heightMap,
			colorMap,
			wireframe,
			categoryLabels,
			seriesNames,
			width,
			height,
		}).then((handle) => {
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
		// Intentionally excludes width/height: size changes are pushed to the live
		// handle by the effect below rather than triggering a full scene remount.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [cols, rows, heightMap, colorMap, wireframe, categoryLabels, seriesNames]);

	// Apply size changes to the live handle.
	useEffect(() => {
		handleRef.current?.resize(width, height);
	}, [width, height]);

	return (
		<div style={{ width, height, position: 'relative' }}>
			{title && (
				<div
					style={{
						position: 'absolute',
						top: 4,
						left: 0,
						right: 0,
						textAlign: 'center',
						fontSize: '12px',
						fontWeight: 600,
						color: '#333',
						zIndex: 1,
						pointerEvents: 'none',
					}}
				>
					{title}
				</div>
			)}
			<div ref={containerRef} style={{ width, height, willChange: 'transform' }} />
		</div>
	);
}

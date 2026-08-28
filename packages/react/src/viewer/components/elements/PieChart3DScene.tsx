/**
 * Inner Three.js scene component for the interactive pie3D-chart view.
 *
 * Lazy-loaded by {@link PieChart3DRenderer} so the shared vanilla-three
 * controller (and `three` itself) is never bundled when the consumer does not
 * install the optional `three` peer dependency.
 *
 * Mounts the framework-agnostic {@link mountPieChart3D} controller from
 * `pptx-viewer-shared` into a container `<div>` via an effect, and disposes it
 * on unmount or when the chart data changes. No `@react-three/*` dependencies.
 * Mirrors {@link ./Bar3DChartScene.tsx} exactly.
 *
 * @module PieChart3DScene
 */

import type { PieChart3DHandle, PieChart3DSceneOptions } from 'pptx-viewer-shared';
import { mountPieChart3D } from 'pptx-viewer-shared';
import React, { useEffect, useRef } from 'react';

export interface PieChart3DSceneProps {
	options: PieChart3DSceneOptions;
}

export default function PieChart3DScene({ options }: PieChart3DSceneProps): React.ReactElement {
	const containerRef = useRef<HTMLDivElement>(null);
	const handleRef = useRef<PieChart3DHandle | null>(null);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) {
			return;
		}
		let disposed = false;
		void mountPieChart3D(container, options).then((handle) => {
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
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [options]);

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

/**
 * Inner Three.js scene component for the interactive area3D-chart view.
 *
 * Lazy-loaded by {@link Area3DChartRenderer} so the shared vanilla-three
 * controller (and `three` itself) is never bundled when the consumer does not
 * install the optional `three` peer dependency.
 *
 * Mounts the framework-agnostic {@link mountAreaChart3D} controller from
 * `pptx-viewer-shared` into a container `<div>` via an effect, and disposes it
 * on unmount or when the chart data changes. No `@react-three/*` dependencies.
 * Mirrors {@link ./Bar3DChartScene.tsx} exactly.
 *
 * @module Area3DChartScene
 */

import type { AreaChart3DHandle, AreaChart3DSceneOptions } from 'pptx-viewer-shared';
import { mountAreaChart3D } from 'pptx-viewer-shared';
import React, { useEffect, useRef } from 'react';

export interface Area3DChartSceneProps {
	options: AreaChart3DSceneOptions;
}

export default function Area3DChartScene({ options }: Area3DChartSceneProps): React.ReactElement {
	const containerRef = useRef<HTMLDivElement>(null);
	const handleRef = useRef<AreaChart3DHandle | null>(null);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) {
			return;
		}
		let disposed = false;
		void mountAreaChart3D(container, options).then((handle) => {
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

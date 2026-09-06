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

import type { ChartPartRef, PieChart3DHandle, PieChart3DSceneOptions } from 'pptx-viewer-shared';
import { mountPieChart3D } from 'pptx-viewer-shared';
import React, { useEffect, useRef } from 'react';

import type { AnyChart3DInteraction } from './chart3d-interaction-hooks';
import { useLatestRef, useStableChart3DInteraction } from './chart3d-interaction-hooks';

export interface PieChart3DSceneProps {
	options: PieChart3DSceneOptions;
	/** Click-to-select + drag-to-value wiring; omit for a read-only mount. */
	interaction?: AnyChart3DInteraction;
	/** External selection (e.g. from the inspector) to mirror onto this scene's highlight. */
	selectedPart?: ChartPartRef | null;
}

export default function PieChart3DScene({
	options,
	interaction,
	selectedPart = null,
}: PieChart3DSceneProps): React.ReactElement {
	const containerRef = useRef<HTMLDivElement>(null);
	const handleRef = useRef<PieChart3DHandle | null>(null);
	const stableInteraction = useStableChart3DInteraction(interaction);
	const selectedPartRef = useLatestRef(selectedPart);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) {
			return;
		}
		let disposed = false;
		void mountPieChart3D(container, options, stableInteraction).then((handle) => {
			if (disposed) {
				handle.dispose();
			} else {
				handleRef.current = handle;
				handle.setSelectedPart(selectedPartRef.current);
			}
			return undefined;
		});
		return () => {
			disposed = true;
			handleRef.current?.dispose();
			handleRef.current = null;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [options, stableInteraction]);

	useEffect(() => {
		handleRef.current?.resize(options.width, options.height);
	}, [options.width, options.height]);

	useEffect(() => {
		handleRef.current?.setSelectedPart(selectedPart);
	}, [selectedPart]);

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

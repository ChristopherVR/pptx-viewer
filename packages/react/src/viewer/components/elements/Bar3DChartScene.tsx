/**
 * Inner Three.js scene component for the interactive bar3D-chart view.
 *
 * Lazy-loaded by {@link Bar3DChartRenderer} so the shared vanilla-three
 * controller (and `three` itself) is never bundled when the consumer does not
 * install the optional `three` peer dependency.
 *
 * Mounts the framework-agnostic {@link mountBarChart3D} controller from
 * `pptx-viewer-shared` into a container `<div>` via an effect, and disposes it
 * on unmount or when the chart data changes. No `@react-three/*` dependencies.
 * Mirrors {@link ./SurfaceChart3DScene.tsx} exactly.
 *
 * @module Bar3DChartScene
 */

import type {
	BarChart3DHandle,
	BarChart3DSceneOptions,
	ChartPartRef,
	TextStyleAnimationDescriptor,
} from 'pptx-viewer-shared';
import { mountBarChart3D } from 'pptx-viewer-shared';
import React, { useEffect, useRef } from 'react';

import type { AnyChart3DInteraction } from './chart3d-interaction-hooks';
import { useLatestRef, useStableChart3DInteraction } from './chart3d-interaction-hooks';

export interface Bar3DChartSceneProps {
	options: BarChart3DSceneOptions;
	/** Click-to-select / drag-to-value wiring; omit for a read-only mount. */
	interaction?: AnyChart3DInteraction;
	/** External selection (e.g. from the inspector) to mirror onto this scene's highlight. */
	selectedPart?: ChartPartRef | null;
	/** Active font-style emphasis override for the axis labels. */
	textStyle?: TextStyleAnimationDescriptor;
}

export default function Bar3DChartScene({
	options,
	interaction,
	selectedPart = null,
	textStyle,
}: Bar3DChartSceneProps): React.ReactElement {
	const containerRef = useRef<HTMLDivElement>(null);
	const handleRef = useRef<BarChart3DHandle | null>(null);
	const stableInteraction = useStableChart3DInteraction(interaction);
	const selectedPartRef = useLatestRef(selectedPart);
	const textStyleRef = useLatestRef(textStyle);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) {
			return;
		}
		let disposed = false;
		void mountBarChart3D(container, options, stableInteraction).then((handle) => {
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
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [options, stableInteraction]);

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

/**
 * Wrapper for the interactive Three.js line3D-chart renderer.
 *
 * Builds the pure per-series path layout from the shared
 * `buildLineChart3DDataForElement` adapter (no `three` import), then
 * lazy-loads {@link Line3DChartScene} so `three` is only pulled in when the
 * optional peer dependency is installed. Falls back to the flat SVG
 * oblique-projection line3D renderer ({@link renderChartElement}) when
 * `three` is unavailable, the chart has no plottable grid, or the scene
 * errors.
 *
 * Mirrors {@link ./Bar3DChartRenderer.tsx}, the established shape for this
 * "WebGL scene with an SVG safety net" pattern.
 *
 * @module Line3DChartRenderer
 */

import type { PptxElement } from 'pptx-viewer-core';
import type { ChartPartRef, TextStyleAnimationDescriptor } from 'pptx-viewer-shared';
import { buildLineChart3DDataForElement } from 'pptx-viewer-shared';
import React, { Suspense, useEffect, useMemo, useState } from 'react';

import { renderChartElement } from '../../utils';
import { LoadingState } from '../LoadingState';
import type { AnyChart3DInteraction } from './chart3d-interaction-hooks';

/** Stub rendered when the dynamic scene import fails. */
function FailedToLoad(): null {
	return null;
}

const LazyLine3DChartScene = React.lazy(
	async (): Promise<{
		default: React.ComponentType<import('./Line3DChartScene').Line3DChartSceneProps>;
	}> => {
		try {
			return await import('./Line3DChartScene');
		} catch {
			return { default: FailedToLoad };
		}
	},
);

interface ErrorBoundaryState {
	hasError: boolean;
}

/** Reverts to the SVG fallback if the WebGL scene throws. */
class SceneErrorBoundary extends React.Component<
	{ children: React.ReactNode; fallback: React.ReactNode },
	ErrorBoundaryState
> {
	constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
		super(props);
		this.state = { hasError: false };
	}
	static getDerivedStateFromError(): ErrorBoundaryState {
		return { hasError: true };
	}
	render(): React.ReactNode {
		return this.state.hasError ? this.props.fallback : this.props.children;
	}
}

interface Line3DChartRendererProps {
	element: PptxElement;
	/** Click-to-select / drag-to-value wiring; omit for a read-only mount. */
	interaction?: AnyChart3DInteraction;
	/** External selection (e.g. from the inspector) to mirror onto this scene's highlight. */
	selectedPart?: ChartPartRef | null;
	/** Active font-style emphasis override for the axis labels. */
	textStyle?: TextStyleAnimationDescriptor;
}

export function Line3DChartRenderer({
	element,
	interaction,
	selectedPart,
	textStyle,
}: Line3DChartRendererProps): React.ReactElement {
	const [threeAvailable, setThreeAvailable] = useState<boolean | null>(null);

	useEffect(() => {
		let cancelled = false;
		import('three')
			.then(() => {
				if (!cancelled) {
					setThreeAvailable(true);
				}
				return undefined;
			})
			.catch(() => {
				if (!cancelled) {
					setThreeAvailable(false);
				}
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const options = useMemo(
		() => buildLineChart3DDataForElement(element, { width: element.width, height: element.height }),
		[element],
	);

	const svgFallback = <>{renderChartElement(element)}</>;

	if (!options || threeAvailable === false) {
		return svgFallback;
	}
	if (threeAvailable === null) {
		return <LoadingState />;
	}

	return (
		<SceneErrorBoundary fallback={svgFallback}>
			<Suspense fallback={<LoadingState />}>
				<LazyLine3DChartScene
					options={options}
					interaction={interaction}
					selectedPart={selectedPart}
					textStyle={textStyle}
				/>
			</Suspense>
		</SceneErrorBoundary>
	);
}

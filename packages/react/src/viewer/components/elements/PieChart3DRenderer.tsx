/**
 * Wrapper for the interactive Three.js pie3D-chart renderer.
 *
 * Builds the pure wedge-mesh layout from the shared `buildPieChart3DDataForElement`
 * adapter (no `three` import), then lazy-loads {@link PieChart3DScene} so
 * `three` is only pulled in when the optional peer dependency is installed.
 * Falls back to the flat SVG oblique-projection pie3D renderer
 * ({@link renderChartElement}) when `three` is unavailable, the chart has no
 * plottable series, or the scene errors.
 *
 * Mirrors {@link ./Bar3DChartRenderer.tsx}, the established shape for this
 * "WebGL scene with an SVG safety net" pattern.
 *
 * @module PieChart3DRenderer
 */

import type { PptxElement } from 'pptx-viewer-core';
import type { ChartPartRef } from 'pptx-viewer-shared';
import { buildPieChart3DDataForElement } from 'pptx-viewer-shared';
import React, { Suspense, useEffect, useMemo, useState } from 'react';

import { renderChartElement } from '../../utils';
import { LoadingState } from '../LoadingState';
import type { AnyChart3DInteraction } from './chart3d-interaction-hooks';

/** Stub rendered when the dynamic scene import fails. */
function FailedToLoad(): null {
	return null;
}

const LazyPieChart3DScene = React.lazy(
	async (): Promise<{
		default: React.ComponentType<import('./PieChart3DScene').PieChart3DSceneProps>;
	}> => {
		try {
			return await import('./PieChart3DScene');
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

interface PieChart3DRendererProps {
	element: PptxElement;
	/** Click-to-select + drag-to-value wiring; omit for a read-only mount. */
	interaction?: AnyChart3DInteraction;
	/** External selection (e.g. from the inspector) to mirror onto this scene's highlight. */
	selectedPart?: ChartPartRef | null;
}

export function PieChart3DRenderer({
	element,
	interaction,
	selectedPart,
}: PieChart3DRendererProps): React.ReactElement {
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
		() => buildPieChart3DDataForElement(element, { width: element.width, height: element.height }),
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
				<LazyPieChart3DScene
					options={options}
					interaction={interaction}
					selectedPart={selectedPart}
				/>
			</Suspense>
		</SceneErrorBoundary>
	);
}

/**
 * Wrapper for the interactive Three.js surface-chart renderer.
 *
 * Builds the pure 3D grid from the shared `buildSurfaceChart3DDataForElement`
 * adapter (no `three` import), then lazy-loads {@link SurfaceChart3DScene} so
 * `three` is only pulled in when the optional peer dependency is installed.
 * Falls back to the SVG surface renderer ({@link renderChartElement}) when
 * `three` is unavailable, the chart has no plottable grid, or the scene
 * errors.
 *
 * Mirrors {@link ./SmartArt3DRenderer.tsx}, the established shape for this
 * "WebGL scene with an SVG safety net" pattern.
 *
 * @module SurfaceChart3DRenderer
 */

import type { PptxElement } from 'pptx-viewer-core';
import { buildSurfaceChart3DDataForElement } from 'pptx-viewer-shared';
import React, { Suspense, useEffect, useMemo, useState } from 'react';

import { renderChartElement } from '../../utils';
import { LoadingState } from '../LoadingState';

/** Stub rendered when the dynamic scene import fails. */
function FailedToLoad(): null {
	return null;
}

const LazySurfaceChart3DScene = React.lazy(
	async (): Promise<{
		default: React.ComponentType<import('./SurfaceChart3DScene').SurfaceChart3DSceneProps>;
	}> => {
		try {
			return await import('./SurfaceChart3DScene');
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

interface SurfaceChart3DRendererProps {
	element: PptxElement;
}

export function SurfaceChart3DRenderer({
	element,
}: SurfaceChart3DRendererProps): React.ReactElement {
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
		() =>
			buildSurfaceChart3DDataForElement(element, { width: element.width, height: element.height }),
		[element],
	);

	const svgFallback = <>{renderChartElement(element)}</>;

	// No plottable grid, or three definitively missing -> SVG.
	if (!options || threeAvailable === false) {
		return svgFallback;
	}
	// Still probing for three -> a lightweight spinner, not the 2D chart (which
	// would otherwise flash on screen right before the 3D scene replaces it).
	if (threeAvailable === null) {
		return <LoadingState />;
	}

	return (
		<SceneErrorBoundary fallback={svgFallback}>
			<Suspense fallback={<LoadingState />}>
				<LazySurfaceChart3DScene options={options} />
			</Suspense>
		</SceneErrorBoundary>
	);
}

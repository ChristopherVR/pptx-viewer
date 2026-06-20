/**
 * Wrapper for the Three.js SmartArt renderer.
 *
 * Builds the pure 3D model from the shared SmartArt layout engine (no `three`
 * import), then lazy-loads {@link SmartArt3DScene} so `three` is only pulled in
 * when the optional peer dependency is installed. Falls back to the SVG
 * {@link SmartArtRenderer} when `three` is unavailable, the diagram has no
 * geometry, or the scene errors.
 *
 * @module SmartArt3DRenderer
 */

import type { PptxElement } from 'pptx-viewer-core';
import { buildSmartArt3DModel, computeSmartArtLayout } from 'pptx-viewer-shared';
import React, { Suspense, useEffect, useMemo, useState } from 'react';

import { resolvePalette, resolveStyle } from '../../utils/smartart-helpers';
import { SmartArtRenderer } from './SmartArtRenderer';

/** Stub rendered when the dynamic scene import fails. */
function FailedToLoad(): null {
	return null;
}

const LazySmartArt3DScene = React.lazy(
	async (): Promise<{
		default: React.ComponentType<import('./SmartArt3DScene').SmartArt3DSceneProps>;
	}> => {
		try {
			return await import('./SmartArt3DScene');
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

interface SmartArt3DRendererProps {
	element: PptxElement;
	className?: string;
	interactive?: boolean;
}

export function SmartArt3DRenderer({
	element,
	className,
	interactive = false,
}: SmartArt3DRendererProps): React.ReactElement {
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

	const model = useMemo(() => {
		if (element.type !== 'smartArt' || !element.smartArtData) {
			return null;
		}
		const { nodes, resolvedLayoutType, layout, chrome } = element.smartArtData;
		if (nodes.length === 0) {
			return null;
		}
		const palette = resolvePalette(element);
		const style = resolveStyle(element);
		const layoutResult = computeSmartArtLayout(
			nodes,
			{ width: element.width, height: element.height },
			palette,
			style,
			element.id,
			resolvedLayoutType,
			layout,
		);
		return buildSmartArt3DModel(layoutResult, { background: chrome?.backgroundColor });
	}, [element]);

	const svgFallback = <SmartArtRenderer element={element} className={className} />;

	// No geometry, or three definitively missing -> SVG.
	if (!model || model.meshes.length === 0 || threeAvailable === false) {
		return svgFallback;
	}
	// Still probing for three -> show SVG until we know (avoids a flash of empty).
	if (threeAvailable === null) {
		return svgFallback;
	}

	return (
		<SceneErrorBoundary fallback={svgFallback}>
			<Suspense fallback={svgFallback}>
				<LazySmartArt3DScene
					model={model}
					width={element.width}
					height={element.height}
					interactive={interactive}
				/>
			</Suspense>
		</SceneErrorBoundary>
	);
}

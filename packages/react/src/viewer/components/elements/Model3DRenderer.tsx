/**
 * Wrapper component for rendering 3D model elements (GLB/GLTF).
 *
 * Lazy-loads {@link Model3DScene} so Three.js is never bundled when
 * the consumer does not install the optional `three` peer dependency.
 *
 * Falls back to the poster/preview image when:
 * - Three.js is not installed
 * - The model data is missing or invalid
 * - An error occurs during rendering
 *
 * @module Model3DRenderer
 */

import type { Model3DPptxElement } from 'pptx-viewer-core';
import { modelDataToBlobUrl } from 'pptx-viewer-shared';
import React, { Suspense, useState, useEffect, useMemo } from 'react';

// ---------------------------------------------------------------------------
// Lazy-loaded Three.js scene (only resolved when three is installed)
// ---------------------------------------------------------------------------

/** Stub component rendered when the dynamic import fails. */
function FailedToLoad() {
	return null;
}

const LazyModel3DScene = React.lazy(
	async (): Promise<{
		default: React.ComponentType<import('./Model3DScene').Model3DSceneProps>;
	}> => {
		try {
			return await import('./Model3DScene');
		} catch {
			return { default: FailedToLoad };
		}
	},
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a `Model3DPptxElement`'s `modelData` (base64 data URL) to an object
 * (blob) URL suitable for Three.js loaders, using the element's own
 * `modelMimeType` (falling back to the shared `DEFAULT_MODEL_MIME`). Thin
 * wrapper over the shared `modelDataToBlobUrl` (render/model3d-scene.ts),
 * which Vue, Svelte, and Vanilla also consume; this used to be a private,
 * hand-decoded copy that inferred its MIME from the data URL itself instead
 * of the element's `modelMimeType` field.
 */
export function dataUrlToBlobUrl(
	dataUrl: string | undefined,
	mimeType?: string | undefined,
): string | undefined {
	return modelDataToBlobUrl(dataUrl, mimeType);
}

// ---------------------------------------------------------------------------
// Poster fallback
// ---------------------------------------------------------------------------

function PosterFallback({
	element,
	width,
	height,
}: {
	element: Model3DPptxElement;
	width: number;
	height: number;
}) {
	const src = element.posterImage ?? element.imageData;
	if (src) {
		return (
			<img
				src={src}
				alt='3D Model'
				className='pointer-events-none select-none'
				style={{
					width,
					height,
					objectFit: 'contain',
				}}
				draggable={false}
			/>
		);
	}
	return (
		<div
			className='w-full h-full flex flex-col items-center justify-center text-[11px] text-gray-400 bg-gray-50 border border-dashed border-gray-200 rounded'
			style={{ width, height }}
		>
			<svg
				xmlns='http://www.w3.org/2000/svg'
				width='24'
				height='24'
				viewBox='0 0 24 24'
				fill='none'
				stroke='currentColor'
				strokeWidth='1.5'
				strokeLinecap='round'
				strokeLinejoin='round'
				className='mb-1 text-gray-300'
			>
				<path d='M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z' />
				<polyline points='3.27 6.96 12 12.01 20.73 6.96' />
				<line x1='12' y1='22.08' x2='12' y2='12' />
			</svg>
			<span>3D Model</span>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Error boundary
// ---------------------------------------------------------------------------

interface ErrorBoundaryState {
	hasError: boolean;
}

class Model3DErrorBoundary extends React.Component<
	{
		children: React.ReactNode;
		fallback: React.ReactNode;
	},
	ErrorBoundaryState
> {
	constructor(props: { children: React.ReactNode; fallback: React.ReactNode }) {
		super(props);
		this.state = { hasError: false };
	}

	static getDerivedStateFromError(): ErrorBoundaryState {
		return { hasError: true };
	}

	render() {
		if (this.state.hasError) {
			return this.props.fallback;
		}
		return this.props.children;
	}
}

// ---------------------------------------------------------------------------
// Main renderer
// ---------------------------------------------------------------------------

export interface Model3DRendererProps {
	element: Model3DPptxElement;
	width: number;
	height: number;
	interactive: boolean;
}

export function Model3DRenderer({ element, width, height, interactive }: Model3DRendererProps) {
	const [threeAvailable, setThreeAvailable] = useState<boolean | null>(null);

	// Probe for Three.js availability once on mount.
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

	// Convert modelData (base64 data URL) to a blob URL for the GLTF loader.
	const blobUrl = useMemo(
		() => dataUrlToBlobUrl(element.modelData, element.modelMimeType),
		[element.modelData, element.modelMimeType],
	);

	// Clean up the blob URL on unmount or when modelData changes.
	useEffect(() => {
		return () => {
			if (blobUrl) {
				URL.revokeObjectURL(blobUrl);
			}
		};
	}, [blobUrl]);

	const posterFallback = <PosterFallback element={element} width={width} height={height} />;

	// Still probing for Three.js -- show poster while we wait.
	if (threeAvailable === null) {
		return posterFallback;
	}

	// Three.js not available or no model data -- permanent poster fallback.
	if (!threeAvailable || !blobUrl) {
		return posterFallback;
	}

	return (
		<Model3DErrorBoundary fallback={posterFallback}>
			<Suspense fallback={posterFallback}>
				<LazyModel3DScene
					modelUrl={blobUrl}
					interactive={interactive}
					width={width}
					height={height}
				/>
			</Suspense>
		</Model3DErrorBoundary>
	);
}

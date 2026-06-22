/**
 * Inner Three.js scene component for rendering 3D models (GLB/GLTF).
 *
 * This file is lazy-loaded by {@link Model3DRenderer} so that the shared
 * vanilla-three controller (and `three` itself) is never bundled when the
 * consumer does not install the optional `three` peer dependency.
 *
 * It mounts the framework-agnostic {@link mountModel3D} controller from
 * `pptx-viewer-shared` into a container `<div>` via an effect, and disposes it
 * on unmount or when its inputs change. No `@react-three/*` dependencies.
 *
 * @module Model3DScene
 */

import { mountModel3D } from 'pptx-viewer-shared';
import type { Model3DHandle } from 'pptx-viewer-shared';
import React, { useRef, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Model3DScene - the exported default used by React.lazy()
// ---------------------------------------------------------------------------

export interface Model3DSceneProps {
	modelUrl: string;
	interactive: boolean;
	width: number;
	height: number;
}

export default function Model3DScene({ modelUrl, interactive, width, height }: Model3DSceneProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const handleRef = useRef<Model3DHandle | null>(null);

	// Mount the shared controller for the current model URL. Recreated when the
	// URL changes; interactivity/size changes are applied without a remount.
	useEffect(() => {
		const container = containerRef.current;
		if (!container) {
			return;
		}
		let disposed = false;
		void mountModel3D(container, modelUrl, { width, height, interactive }).then((handle) => {
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
		// Intentionally keyed on modelUrl only: size/interactivity are pushed to
		// the live handle by the effects below to avoid a costly scene remount.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [modelUrl]);

	// Apply interactivity toggles to the live handle.
	useEffect(() => {
		handleRef.current?.setInteractive(interactive);
	}, [interactive]);

	// Apply size changes to the live handle.
	useEffect(() => {
		handleRef.current?.resize(width, height);
	}, [width, height]);

	return (
		<div
			ref={containerRef}
			style={{
				width,
				height,
				willChange: 'transform',
			}}
		/>
	);
}

/**
 * Inner Three.js scene for SmartArt diagrams.
 *
 * Lazy-loaded by {@link SmartArt3DRenderer} so `three` (and the shared
 * `pptx-viewer-shared/smartart-3d` scene runtime it pulls in) is never bundled
 * unless the consumer installs the optional `three` peer dependency. Mounts the
 * framework-agnostic vanilla scene onto a canvas and disposes it on unmount.
 *
 * @module SmartArt3DScene
 */

import type { SmartArt3DModel } from 'pptx-viewer-shared';
import { mountSmartArt3D } from 'pptx-viewer-shared/smartart-3d';
import type { SmartArt3DHandle } from 'pptx-viewer-shared/smartart-3d';
import React, { useEffect, useRef } from 'react';

export interface SmartArt3DSceneProps {
	model: SmartArt3DModel;
	width: number;
	height: number;
	interactive: boolean;
}

export default function SmartArt3DScene({
	model,
	width,
	height,
	interactive,
}: SmartArt3DSceneProps): React.ReactElement {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const handleRef = useRef<SmartArt3DHandle | null>(null);

	// Mount once per model; rebuild when the model identity changes.
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) {
			return;
		}
		const handle = mountSmartArt3D(canvas, model, width, height, {
			interactive,
		});
		handleRef.current = handle;
		return () => {
			handle.dispose();
			handleRef.current = null;
		};
		// width/height/interactive changes are handled by the effects below to
		// avoid tearing down the whole scene on a resize.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [model]);

	// Resize without re-mounting.
	useEffect(() => {
		handleRef.current?.resize(width, height);
	}, [width, height]);

	// Toggle interactivity without re-mounting.
	useEffect(() => {
		handleRef.current?.setInteractive(interactive);
	}, [interactive]);

	return (
		<canvas
			ref={canvasRef}
			style={{ width, height, display: 'block', pointerEvents: interactive ? 'auto' : 'none' }}
		/>
	);
}

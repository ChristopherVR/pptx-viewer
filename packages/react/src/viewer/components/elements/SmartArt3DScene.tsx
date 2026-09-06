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

import type { SmartArt3DModel, TextStyleAnimationDescriptor } from 'pptx-viewer-shared';
import { mountSmartArt3D } from 'pptx-viewer-shared/smartart-3d';
import type { SmartArt3DHandle } from 'pptx-viewer-shared/smartart-3d';
import React, { useEffect, useRef } from 'react';

import { useLatestRef } from './chart3d-interaction-hooks';

export interface SmartArt3DSceneProps {
	model: SmartArt3DModel;
	width: number;
	height: number;
	interactive: boolean;
	/** Active font-style emphasis override for every node's caption. */
	textStyle?: TextStyleAnimationDescriptor;
}

export default function SmartArt3DScene({
	model,
	width,
	height,
	interactive,
	textStyle,
}: SmartArt3DSceneProps): React.ReactElement {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const handleRef = useRef<SmartArt3DHandle | null>(null);
	const textStyleRef = useLatestRef(textStyle);

	// Mount once per model; rebuild when the model identity changes.
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) {
			return;
		}
		const handle = mountSmartArt3D(canvas, model, width, height, {
			interactive,
			textStyle: textStyleRef.current,
		});
		handleRef.current = handle;
		return () => {
			handle.dispose();
			handleRef.current = null;
		};
		// width/height/interactive/textStyle changes are handled by the effects
		// below to avoid tearing down the whole scene on a resize or a style tick.
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

	// Apply/clear the emphasis override without re-mounting.
	useEffect(() => {
		handleRef.current?.setTextStyle(textStyle);
	}, [textStyle]);

	return (
		<canvas
			ref={canvasRef}
			style={{ width, height, display: 'block', pointerEvents: interactive ? 'auto' : 'none' }}
		/>
	);
}

/**
 * SmartArt element dispatcher.
 *
 * Chooses between the Three.js renderer (when the host opts in via the
 * `smartArt3D` prop, surfaced through {@link SmartArt3DContext}) and the default
 * SVG {@link SmartArtRenderer}. The 3D path itself falls back to SVG when the
 * optional `three` dependency is absent.
 */

import type { PptxElement } from 'pptx-viewer-core';
import type { ElementAnimationState } from 'pptx-viewer-shared';
import React, { useContext } from 'react';

import { SmartArt3DContext } from './smart-art-3d-context';
import { SmartArt3DRenderer } from './SmartArt3DRenderer';
import { SmartArtRenderer } from './SmartArtRenderer';

interface SmartArtElementProps {
	element: PptxElement;
	className?: string;
	/** Enables inline (on-canvas) node text editing. */
	canEdit?: boolean;
	/** Commit element updates (node text edits) through the host editor path. */
	onUpdateElement?: (updates: Partial<PptxElement>) => void;
	/**
	 * Playback state for the diagram. A staged diagram build
	 * (`build.kind === 'diagram'`) reveals nodes progressively in the SVG path.
	 */
	animationState?: ElementAnimationState;
}

export function SmartArtElement({
	element,
	className,
	canEdit,
	onUpdateElement,
	animationState,
}: SmartArtElementProps): React.ReactElement {
	const use3D = useContext(SmartArt3DContext);
	if (use3D) {
		return (
			<SmartArt3DRenderer
				element={element}
				className={className}
				canEdit={canEdit}
				onUpdateElement={onUpdateElement}
			/>
		);
	}
	return (
		<SmartArtRenderer
			element={element}
			className={className}
			canEdit={canEdit}
			onUpdateElement={onUpdateElement}
			animationState={animationState}
		/>
	);
}

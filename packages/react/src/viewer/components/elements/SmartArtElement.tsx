/**
 * SmartArt element entry point.
 *
 * Reads the host's `smartArt3D` opt-in (narrowed by the viewer user's own
 * Options > Advanced override) and hands it to {@link SmartArt3DView}, which
 * decides per element whether a `<pptx-three-view>` 3D scene applies and
 * falls back to the default SVG {@link SmartArtRenderer} otherwise.
 */

import type { PptxElement } from 'pptx-viewer-core';
import type { ElementAnimationState } from 'pptx-viewer-shared';
import React, { useContext } from 'react';

import { Rendering3DFlagsContext } from './rendering-3d-flags-context';
import { SmartArt3DView } from './SmartArt3DView';

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
	const { smartArt3D } = useContext(Rendering3DFlagsContext);
	return (
		<SmartArt3DView
			element={element}
			className={className}
			smartArt3D={smartArt3D}
			canEdit={canEdit}
			onUpdateElement={onUpdateElement}
			animationState={animationState}
		/>
	);
}

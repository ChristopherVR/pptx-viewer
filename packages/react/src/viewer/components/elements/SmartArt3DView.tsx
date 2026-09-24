/**
 * Renders a SmartArt element's `<pptx-three-view>` when the host opted into
 * `smartArt3D` and the diagram resolves to a 3D model; falls back to the
 * flat SVG {@link SmartArtRenderer} otherwise (flag off, wrong element type,
 * or no geometry - see `resolveSmartArtThreeViewSpec`).
 *
 * When editable, layers the existing inline node-text-edit overlay
 * ({@link SmartArtEditableLayer}, an invisible copy of the 2D renderer) on
 * top of the scene, exactly as the pre-`<pptx-three-view>` `SmartArt3DRenderer`
 * did: only the layer underneath (3D scene vs. SVG canvas) changed.
 *
 * @module SmartArt3DView
 */
import type { PptxElement } from 'pptx-viewer-core';
import { updateSmartArtNodeText } from 'pptx-viewer-core';
import type { ElementAnimationState } from 'pptx-viewer-shared';
import { resolveSmartArtThreeViewSpec, shouldCommitSmartArtNodeText } from 'pptx-viewer-shared';
import React, { useMemo } from 'react';

import { SmartArtEditableLayer } from './SmartArtEditableLayer';
import { SmartArtRenderer } from './SmartArtRenderer';
import { ThreeView } from './ThreeView';

interface SmartArt3DViewProps {
	element: PptxElement;
	className?: string;
	/** The host's `smartArt3D` opt-in, already narrowed by the viewer user's Options > Advanced override. */
	smartArt3D: boolean;
	/** Enables inline (on-canvas) node text editing. */
	canEdit?: boolean;
	/** Commit element updates (node text edits) through the host editor path. */
	onUpdateElement?: (updates: Partial<PptxElement>) => void;
	/**
	 * Playback state for the diagram. A staged diagram build reveals nodes
	 * progressively in the SVG path only (the 3D scene does not animate a
	 * reveal); passed through to the plain-2D fallback when `smartArt3D` does
	 * not apply to this element.
	 */
	animationState?: ElementAnimationState;
}

export function SmartArt3DView({
	element,
	className,
	smartArt3D,
	canEdit,
	onUpdateElement,
	animationState,
}: SmartArt3DViewProps): React.ReactElement {
	const spec = useMemo(
		() => resolveSmartArtThreeViewSpec(element, smartArt3D),
		[element, smartArt3D],
	);

	if (!spec) {
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

	const sceneNode = (
		<ThreeView spec={spec} interactive={Boolean(canEdit)} textStyle={animationState?.textStyle}>
			<SmartArtRenderer element={element} className={className} />
		</ThreeView>
	);

	const editEnabled = canEdit && Boolean(onUpdateElement);
	const smartArtData = element.type === 'smartArt' ? element.smartArtData : undefined;

	if (!editEnabled || !smartArtData) {
		return sceneNode;
	}

	const handleCommitNodeText = (nodeId: string, text: string): void => {
		if (!shouldCommitSmartArtNodeText(smartArtData, nodeId, text)) {
			return;
		}
		onUpdateElement!({
			smartArtData: updateSmartArtNodeText(smartArtData, nodeId, text),
		} as Partial<PptxElement>);
	};

	return (
		<div className='relative' style={{ width: element.width, height: element.height }}>
			{sceneNode}
			{/* Invisible SVG hit-test layer: pointer-events fire on tagged node groups */}
			<SmartArtEditableLayer
				smartArtData={smartArtData}
				canEdit
				onCommitNodeText={handleCommitNodeText}
			>
				<div className='absolute inset-0 opacity-0'>
					<SmartArtRenderer element={element} canEdit={false} />
				</div>
			</SmartArtEditableLayer>
		</div>
	);
}

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
import type { ElementAnimationState } from 'pptx-viewer-shared';
import {
	commitSmartArtNodeFill,
	commitSmartArtNodeText,
	measureSvgViewportRect,
	resolvePalette,
	resolveSmartArtThreeViewSpec,
} from 'pptx-viewer-shared';
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
		const next = commitSmartArtNodeText(element, nodeId, text);
		if (next) {
			onUpdateElement!({ smartArtData: next } as Partial<PptxElement>);
		}
	};

	// The same hover swatch bar the 2D renderer offers, over the scene.
	const handleChangeNodeStyle = (nodeId: string, fill: string): void => {
		const next = commitSmartArtNodeFill(element, nodeId, fill);
		if (next) {
			onUpdateElement!({ smartArtData: next } as Partial<PptxElement>);
		}
	};

	return (
		<div className='relative' style={{ width: element.width, height: element.height }}>
			{sceneNode}
			{/* Invisible SVG hit-test layer: pointer-events fire on tagged node groups */}
			<SmartArtEditableLayer
				smartArtData={smartArtData}
				canEdit
				onCommitNodeText={handleCommitNodeText}
				palette={resolvePalette(smartArtData)}
				onChangeNodeStyle={handleChangeNodeStyle}
				// In the diagram's own SVG coordinates, as the 2D renderer measures:
				// screen rects are wrong once the element is turned or the slide zoomed.
				measureNodeRect={measureSvgViewportRect}
			>
				<div className='absolute inset-0 opacity-0'>
					<SmartArtRenderer element={element} canEdit={false} />
				</div>
			</SmartArtEditableLayer>
		</div>
	);
}

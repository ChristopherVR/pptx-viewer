import type { CollabLoadOrigin, CollaborationConfig } from 'pptx-viewer-shared';
import { resolveSlideSizeSelection } from 'pptx-viewer-shared';
import React from 'react';

import { CollaborationCursorOverlay } from '../components/collaboration/CollaborationCursorOverlay';
import { useCollaborationDocumentSync } from './collaboration/useCollaborationDocumentSync';
import { useCollaborativeState } from './collaboration/useCollaborativeState';
import type { ViewerBuildingBlocksCore } from './useViewerBuildingBlocksCore';

export interface BuildingBlocksCollaborationInput {
	core: ViewerBuildingBlocksCore;
	config?: CollaborationConfig;
	content: ArrayBuffer | Uint8Array | null;
	loadVersion: number;
	loadOrigin: CollabLoadOrigin;
	embedFonts: boolean;
}

/** No extra provider or transport is required around a custom editor shell. */
export function useViewerBuildingBlocksCollaboration(input: BuildingBlocksCollaborationInput) {
	const { state, activeSlideIndex } = input.core;
	const collaboration = useCollaborativeState({
		config: input.config,
		canvasWidth: state.canvasSize.width,
		canvasHeight: state.canvasSize.height,
	});
	useCollaborationDocumentSync({
		collaboration,
		content: input.content,
		slides: state.slides,
		setSlides: state.setSlides,
		templateElementsBySlideId: state.templateElementsBySlideId,
		loadVersion: input.loadVersion,
		loadOrigin: input.loadOrigin,
		livePatcher: state.livePatcher,
		deckSaveState: {
			...state,
			embedFonts: input.embedFonts,
			slideSize: resolveSlideSizeSelection({
				current: state.slideSizeEmu,
				canvas: state.canvasSize,
			}).size,
		},
	});
	const overlay = collaboration ? (
		<CollaborationCursorOverlay
			collaboration={collaboration}
			activeSlideIndex={activeSlideIndex}
			selectedElementId={state.selectedElementId}
			canvasWidth={state.canvasSize.width}
			canvasHeight={state.canvasSize.height}
		/>
	) : undefined;
	return { collaboration, overlay };
}

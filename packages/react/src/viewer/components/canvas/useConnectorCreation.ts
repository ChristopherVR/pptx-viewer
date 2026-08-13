import type { ConnectorPptxElement, PptxSlide } from 'pptx-viewer-core';
import { authorConnectorBetweenSites } from 'pptx-viewer-shared';
import React, { useCallback, useState } from 'react';

import type { ZoomViewport } from './canvas-types';

/* ------------------------------------------------------------------ */
/*  State type                                                         */
/* ------------------------------------------------------------------ */

export interface ConnectorDragState {
	startElementId: string;
	startSiteIndex: number;
	currentX: number;
	currentY: number;
}

/* ------------------------------------------------------------------ */
/*  Return type                                                        */
/* ------------------------------------------------------------------ */

export interface ConnectorCreationState {
	connectorDragState: ConnectorDragState | null;
	handleConnectionSiteDown: (elementId: string, siteIndex: number, e: React.MouseEvent) => void;
	handleConnectorDragMove: (e: React.MouseEvent) => void;
	handleConnectionSiteDrop: (targetElementId: string, targetSiteIndex: number) => void;
	handleConnectorDragEnd: () => void;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useConnectorCreation({
	activeSlide,
	zoom: _zoom,
	onCreateConnector,
}: {
	activeSlide: PptxSlide | undefined;
	zoom: ZoomViewport;
	onCreateConnector?: (connector: ConnectorPptxElement) => void;
}): ConnectorCreationState {
	const [connectorDragState, setConnectorDragState] = useState<ConnectorDragState | null>(null);

	/** Start dragging a connector from a connection site. */
	const handleConnectionSiteDown = useCallback(
		(elementId: string, siteIndex: number, e: React.MouseEvent) => {
			e.stopPropagation();
			e.preventDefault();
			setConnectorDragState({
				startElementId: elementId,
				startSiteIndex: siteIndex,
				currentX: e.clientX,
				currentY: e.clientY,
			});
		},
		[],
	);

	/** Handle mouse move during connector drag. */
	const handleConnectorDragMove = useCallback(
		(e: React.MouseEvent) => {
			if (!connectorDragState) {
				return;
			}
			setConnectorDragState((prev) =>
				prev ? { ...prev, currentX: e.clientX, currentY: e.clientY } : null,
			);
		},
		[connectorDragState],
	);

	/** Finish connector creation by dropping on a target connection site. */
	const handleConnectionSiteDrop = useCallback(
		(targetElementId: string, targetSiteIndex: number) => {
			if (!connectorDragState || !onCreateConnector) {
				return;
			}
			const startEl = activeSlide?.elements.find(
				(el) => el.id === connectorDragState.startElementId,
			);
			const endEl = activeSlide?.elements.find((el) => el.id === targetElementId);
			if (!startEl || !endEl) {
				setConnectorDragState(null);
				return;
			}

			// Shared decides the span, the preset and the `a:stCxn`/`a:endCxn`
			// bindings, resolving each site index through the same list
			// `rerouteConnectorsForMovedElements` reads. This hook used to snap
			// against the four edge midpoints instead, so on a shape with a real
			// `a:cxnLst` the connector was drawn to one point and jumped to another
			// the first time that shape was dragged. It also returns null for a
			// both-ends-on-one-shape drag, which used to be a separate guard here.
			const authored = authorConnectorBetweenSites(
				{ element: startEl, siteIndex: connectorDragState.startSiteIndex },
				{ element: endEl, siteIndex: targetSiteIndex },
			);
			if (!authored) {
				setConnectorDragState(null);
				return;
			}

			const newConnector: ConnectorPptxElement = {
				id: `conn-new-${Date.now()}`,
				type: 'connector',
				x: authored.x,
				y: authored.y,
				width: authored.width,
				height: authored.height,
				shapeType: authored.shapeType,
				shapeStyle: {
					strokeColor: '#4472C4',
					strokeWidth: 2,
					connectorStartConnection: authored.startConnection,
					connectorEndConnection: authored.endConnection,
				},
			};

			onCreateConnector(newConnector);
			setConnectorDragState(null);
		},
		[connectorDragState, onCreateConnector, activeSlide?.elements],
	);

	/** Cancel connector drag on mouse up over empty space. */
	const handleConnectorDragEnd = useCallback(() => {
		setConnectorDragState(null);
	}, []);

	return {
		connectorDragState,
		handleConnectionSiteDown,
		handleConnectorDragMove,
		handleConnectionSiteDrop,
		handleConnectorDragEnd,
	};
}

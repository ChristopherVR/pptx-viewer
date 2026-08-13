/**
 * Connector endpoint authoring: the two handles PowerPoint puts on a selected
 * connector, which attach an end to a shape's connection point or detach it.
 *
 * Until this existed the binding could DRAW a connector but never bind one:
 * `a:stCxn` / `a:endCxn` were written by nothing reachable, so
 * `connector-reroute` (a connector following the shape it is anchored to) only
 * ever fired for connectors that arrived bound from a `.pptx`.
 *
 * Every decision is shared (`render/connector-endpoints`); this component owns
 * only the pointer lifecycle and the SVG.
 */
import type { ConnectorPptxElement, PptxElement } from 'pptx-viewer-core';
import {
	CONNECTOR_SITE_SNAP_PX,
	collectConnectorSiteCandidates,
	findConnectorSiteNear,
	getConnectorEndpointHandles,
	resolveConnectorEndpointUpdate,
	withConnectorEndpointUpdate,
} from 'pptx-viewer-shared';
import type { ConnectorEndpointKind } from 'pptx-viewer-shared';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ConnectorEndpointOverlayProps {
	connector: PptxElement;
	elements: PptxElement[];
	/** Screen px per slide px. */
	editorScale: number;
	canvasStageRef: React.RefObject<HTMLDivElement | null>;
	onUpdateElement: (elementId: string, updates: Partial<PptxElement>) => void;
}

interface EndpointDrag {
	kind: ConnectorEndpointKind;
	x: number;
	y: number;
}

export function ConnectorEndpointOverlay({
	connector,
	elements,
	editorScale,
	canvasStageRef,
	onUpdateElement,
}: ConnectorEndpointOverlayProps) {
	const { t } = useTranslation();
	const [drag, setDrag] = useState<EndpointDrag | null>(null);

	// A connector may never bind to itself, and the candidate list is the same
	// one the reroute resolves site indices through.
	const candidates = useMemo(
		() => collectConnectorSiteCandidates(elements.filter((el) => el.id !== connector.id)),
		[elements, connector.id],
	);
	const handles = getConnectorEndpointHandles(connector);
	const snap = drag ? findConnectorSiteNear(candidates, drag.x, drag.y) : null;

	const toSlidePoint = useCallback(
		(clientX: number, clientY: number): { x: number; y: number } => {
			const rect = canvasStageRef.current?.getBoundingClientRect();
			const scale = editorScale || 1;
			return {
				x: (clientX - (rect?.left ?? 0)) / scale,
				y: (clientY - (rect?.top ?? 0)) / scale,
			};
		},
		[canvasStageRef, editorScale],
	);

	useEffect(() => {
		if (!drag) {
			return;
		}
		const onMove = (event: PointerEvent): void => {
			const point = toSlidePoint(event.clientX, event.clientY);
			setDrag((prev) => (prev ? { ...prev, ...point } : prev));
		};
		const onUp = (event: PointerEvent): void => {
			const point = toSlidePoint(event.clientX, event.clientY);
			const target = findConnectorSiteNear(candidates, point.x, point.y, CONNECTOR_SITE_SNAP_PX);
			const update = resolveConnectorEndpointUpdate(connector, elements, drag.kind, point, target);
			const next = withConnectorEndpointUpdate(connector, update) as ConnectorPptxElement;
			onUpdateElement(connector.id, {
				x: next.x,
				y: next.y,
				width: next.width,
				height: next.height,
				flipHorizontal: next.flipHorizontal,
				flipVertical: next.flipVertical,
				// Sent whole: a DETACHED end has had its binding key deleted, so a
				// merge of only the surviving keys would leave the stale one behind.
				shapeStyle: next.shapeStyle,
			} as Partial<PptxElement>);
			setDrag(null);
		};
		window.addEventListener('pointermove', onMove);
		window.addEventListener('pointerup', onUp);
		window.addEventListener('pointercancel', onUp);
		return () => {
			window.removeEventListener('pointermove', onMove);
			window.removeEventListener('pointerup', onUp);
			window.removeEventListener('pointercancel', onUp);
		};
	}, [drag, candidates, connector, elements, onUpdateElement, toSlidePoint]);

	return (
		<div className='absolute inset-0 z-[56] pointer-events-none' data-pptx-connector-endpoints>
			{/* Candidate connection points, revealed only while an end is in flight
			    so they never obscure the deck at rest. */}
			{drag
				? candidates.map((site) => (
						<div
							key={`${site.elementId}-${site.siteIndex}`}
							aria-hidden='true'
							data-pptx-connection-site
							className='absolute rounded-full border-2 border-blue-500'
							style={{
								left: site.x - 4,
								top: site.y - 4,
								width: 8,
								height: 8,
								background:
									snap?.elementId === site.elementId && snap.siteIndex === site.siteIndex
										? '#3b82f6'
										: 'rgba(96,165,250,0.6)',
							}}
						/>
					))
				: null}

			{handles.map((handle) => (
				<button
					key={handle.kind}
					type='button'
					data-pptx-connector-endpoint={handle.kind}
					data-pptx-connector-attached={String(handle.attached)}
					aria-label={t(
						handle.kind === 'start'
							? 'pptx.canvas.connectorEndpointStart'
							: 'pptx.canvas.connectorEndpointEnd',
					)}
					className='absolute rounded-full border-2 border-white shadow'
					style={{
						left: (drag?.kind === handle.kind ? drag.x : handle.x) - 5,
						top: (drag?.kind === handle.kind ? drag.y : handle.y) - 5,
						width: 10,
						height: 10,
						// A bound end is filled, a loose one hollow, so "is this
						// connector actually attached?" is answerable at a glance.
						background: handle.attached ? '#16a34a' : '#ffffff',
						boxShadow: '0 0 0 1px #16a34a',
						cursor: 'crosshair',
						pointerEvents: 'auto',
						touchAction: 'none',
					}}
					onPointerDown={(event) => {
						event.stopPropagation();
						event.preventDefault();
						const point = toSlidePoint(event.clientX, event.clientY);
						setDrag({ kind: handle.kind, ...point });
					}}
				/>
			))}
		</div>
	);
}

import type { PptxElement } from 'pptx-viewer-core';
import {
	collectConnectorSiteCandidates,
	findConnectorSiteNear,
	getConnectorEndpointHandles,
	resolveConnectorEndpointUpdate,
	withConnectorEndpointUpdate,
} from 'pptx-viewer-shared';
import type { ConnectorEndpointKind } from 'pptx-viewer-shared';

import type { Store, ViewerState } from '../state';
import { getActiveElements, replaceActiveElements } from './editor-active-elements';
import type { EditorOps } from './editor-operations';

/**
 * Connector endpoint authoring: the two handles PowerPoint puts on a selected
 * connector, which attach an end to a shape's connection point or detach it.
 *
 * Vanilla could DRAW a connector but never bind one: nothing in this binding
 * ever wrote `a:stCxn` / `a:endCxn`, so `connector-reroute` (a connector
 * following the shape it is anchored to) only ever fired for connectors that
 * arrived already bound from a `.pptx`.
 *
 * Like the selection overlay this layer is UNSCALED, so slide coordinates are
 * multiplied by the stage scale on the way out and pointer positions divided by
 * it on the way in. Every decision is shared (`render/connector-endpoints`);
 * this module owns only the DOM and the pointer lifecycle.
 *
 * @module editor/connector-endpoint-overlay
 */

export interface ConnectorEndpointOverlayDeps {
	doc: Document;
	store: Store<ViewerState>;
	ops: EditorOps;
	/** Stage scale (screen px per slide px). */
	getScale(): number;
	/** Accessible name for an endpoint handle. */
	label(kind: ConnectorEndpointKind): string;
}

export interface ConnectorEndpointOverlay {
	root: HTMLElement;
	mount(host: HTMLElement): void;
	/** Re-render from the current state. */
	sync(): void;
	dispose(): void;
}

/** The single selected connector, or null. */
function selectedConnector(state: ViewerState): PptxElement | null {
	if (!state.editable || state.presenting || state.selectedElementIds.length !== 1) {
		return null;
	}
	const element = getActiveElements(state).find((el) => el.id === state.selectedElementId);
	return element && element.type === 'connector' ? element : null;
}

export function createConnectorEndpointOverlay(
	deps: ConnectorEndpointOverlayDeps,
): ConnectorEndpointOverlay {
	const { doc, store, ops } = deps;
	const root = doc.createElement('div');
	root.className = 'pptxv-connector-endpoints';
	root.setAttribute('data-pptx-connector-endpoints', '');

	let drag: { kind: ConnectorEndpointKind; x: number; y: number } | null = null;

	const stagePoint = (event: PointerEvent): { x: number; y: number } => {
		const rect = root.getBoundingClientRect();
		const scale = deps.getScale() || 1;
		return { x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale };
	};

	const onMove = (event: PointerEvent): void => {
		if (!drag) {
			return;
		}
		drag = { kind: drag.kind, ...stagePoint(event) };
		render();
	};

	const onEnd = (event: PointerEvent): void => {
		const current = drag;
		drag = null;
		detach();
		const state = store.get();
		const connector = selectedConnector(state);
		if (!current || !connector) {
			render();
			return;
		}
		const elements = getActiveElements(state);
		const point = stagePoint(event);
		const target = findConnectorSiteNear(
			collectConnectorSiteCandidates(elements.filter((el) => el.id !== connector.id)),
			point.x,
			point.y,
		);
		const update = resolveConnectorEndpointUpdate(connector, elements, current.kind, point, target);
		const next = withConnectorEndpointUpdate(connector, update);
		ops.pushHistory();
		store.set(
			replaceActiveElements(
				state,
				elements.map((el) => (el.id === connector.id ? next : el)),
			),
		);
		ops.commitChange();
	};

	const detach = (): void => {
		window.removeEventListener('pointermove', onMove);
		window.removeEventListener('pointerup', onEnd);
		window.removeEventListener('pointercancel', onEnd);
	};

	/**
	 * One endpoint handle. Declared outside `render`'s loop so its listener does
	 * not close over a loop variable.
	 */
	function endpointButton(
		handle: { kind: ConnectorEndpointKind; x: number; y: number; attached: boolean },
		scale: number,
	): HTMLButtonElement {
		const button = doc.createElement('button');
		button.type = 'button';
		button.className = 'pptxv-connector-endpoint';
		// A bound end is filled, a loose one hollow, so "is this connector
		// actually attached?" is answerable at a glance.
		if (handle.attached) {
			button.classList.add('is-attached');
		}
		button.dataset.pptxConnectorEndpoint = handle.kind;
		// Framework-neutral e2e contract: whether this end carries a binding.
		button.dataset.pptxConnectorAttached = String(handle.attached);
		button.setAttribute('aria-label', deps.label(handle.kind));
		const live = drag?.kind === handle.kind ? drag : handle;
		button.style.left = `${live.x * scale}px`;
		button.style.top = `${live.y * scale}px`;
		button.addEventListener('pointerdown', (event) => {
			event.preventDefault();
			event.stopPropagation();
			drag = { kind: handle.kind, ...stagePoint(event) };
			window.addEventListener('pointermove', onMove);
			window.addEventListener('pointerup', onEnd);
			window.addEventListener('pointercancel', onEnd);
			render();
		});
		return button;
	}

	function render(): void {
		const state = store.get();
		const connector = selectedConnector(state);
		root.replaceChildren();
		if (!connector) {
			return;
		}
		const scale = deps.getScale() || 1;
		const elements = getActiveElements(state);

		// Candidate sites are revealed only while an end is in flight, so they
		// never obscure the deck at rest.
		if (drag) {
			const candidates = collectConnectorSiteCandidates(
				elements.filter((el) => el.id !== connector.id),
			);
			const snapped = findConnectorSiteNear(candidates, drag.x, drag.y);
			for (const site of candidates) {
				const dot = doc.createElement('div');
				dot.className = 'pptxv-connection-site';
				dot.setAttribute('data-pptx-connection-site', '');
				if (snapped?.elementId === site.elementId && snapped.siteIndex === site.siteIndex) {
					dot.classList.add('is-snapped');
				}
				dot.style.left = `${site.x * scale}px`;
				dot.style.top = `${site.y * scale}px`;
				root.appendChild(dot);
			}
		}

		for (const handle of getConnectorEndpointHandles(connector)) {
			root.appendChild(endpointButton(handle, scale));
		}
	}

	return {
		root,
		mount(host) {
			host.appendChild(root);
			render();
		},
		sync: render,
		dispose() {
			detach();
			drag = null;
			root.remove();
		},
	};
}

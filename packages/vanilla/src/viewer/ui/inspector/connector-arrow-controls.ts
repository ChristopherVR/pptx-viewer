import { CONNECTOR_ARROW_CONTROLS, connectorArrowPatch, schemaLabel } from 'pptx-viewer-shared';
import type { ConnectorArrowControl } from 'pptx-viewer-shared';

import type { Translator } from '../../i18n';
import type { InspectorHandlers, InspectorState } from './types';

/**
 * The connector arrowhead card: the six `a:ln/a:headEnd` and `a:ln/a:tailEnd`
 * properties (each end's type, width and length).
 *
 * WHY it is its own module: Vanilla shipped only the two `type` pickers, inline
 * in `shape-effects-controls`, so a user could choose a triangle head but never
 * its size, and the renderer already honoured all six on paint. Growing that
 * file by four more selects would have pushed it past the size budget, and the
 * arrowhead card is a self-contained concern.
 *
 * The control list, option order, fallbacks and caption keys all come from
 * `pptx-viewer-shared`, so this module only builds DOM and relays a patch
 * through `handlers.setShapeStyle`, which is the path that records undo and
 * repaints the line.
 *
 * @module vanilla-viewer/inspector/connector-arrow-controls
 */
export interface ConnectorArrowControls {
	/** The card root, appended by the caller. */
	el: HTMLElement;
	update(state: InspectorState): void;
}

/** One dropdown plus the descriptor it reads and writes. */
interface ArrowField {
	control: ConnectorArrowControl;
	select: HTMLSelectElement;
}

export function createConnectorArrowControls(
	doc: Document,
	t: Translator,
	handlers: InspectorHandlers,
): ConnectorArrowControls {
	const el = doc.createElement('div');
	el.className = 'pptxv-inspector-connector-arrows';
	const fields = CONNECTOR_ARROW_CONTROLS.map((control) => {
		const field = buildField(doc, t, handlers, control);
		el.appendChild(field.select.parentElement as HTMLElement);
		return field;
	});

	return {
		el,
		update(state) {
			// The whole card belongs to connectors; every other selection hides it
			// rather than offering six inert dropdowns.
			el.hidden = !state.isConnector;
			for (const { control, select } of fields) {
				const current = state.shapeStyle?.[control.styleKey];
				select.value =
					typeof current === 'string' && current.length > 0 ? current : control.fallback;
				// G9: `arrowheadsChangeable` (`a:cxnSpLocks/@noChangeArrowheads`) was
				// already computed in `element-locks.ts` but nothing here consulted it.
				select.disabled = !state.canShape || !state.arrowheadsChangeable;
			}
		},
	};
}

function buildField(
	doc: Document,
	t: Translator,
	handlers: InspectorHandlers,
	control: ConnectorArrowControl,
): ArrowField {
	const select = doc.createElement('select');
	for (const value of control.values) {
		const option = doc.createElement('option');
		option.value = value;
		option.textContent = schemaLabel(control.optionLabelKeys, value, t);
		select.appendChild(option);
	}
	select.addEventListener('change', () =>
		handlers.setShapeStyle(connectorArrowPatch(control, select.value)),
	);
	const wrapper = doc.createElement('label');
	// The caption is the control's accessible name, so it comes from the same key
	// React renders rather than a locally spelled string, and it is set ON the
	// select: a wrapping `<label>` lends its whole text content, which once the
	// options are appended is the caption plus every option.
	wrapper.textContent = t(control.labelKey);
	select.setAttribute('aria-label', t(control.labelKey));
	wrapper.appendChild(select);
	return { control, select };
}

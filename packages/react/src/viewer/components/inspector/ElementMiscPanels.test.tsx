import type { PptxElement } from 'pptx-viewer-core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';

import { ConnectorPanel } from './ElementMiscPanels';

/**
 * G9 (OpenXML parity audit, D3): `arrowheadsChangeable` already existed on
 * `element-locks.ts` (from `a:cxnSpLocks/@noChangeArrowheads`), but no
 * arrowhead panel consulted it - the dropdowns stayed usable on a locked
 * connector, gated only on the document-level `canEdit` flag.
 */
function connector(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		id: 'conn1',
		type: 'connector',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		shapeStyle: { connectorStartArrow: 'none', connectorEndArrow: 'none' },
		...overrides,
	} as unknown as PptxElement;
}

describe('connectorPanel with noChangeArrowheads', () => {
	it('disables every arrowhead dropdown when the connector locks noChangeArrowheads', () => {
		const markup = renderToStaticMarkup(
			<ConnectorPanel
				selectedElement={connector({ locks: { noChangeArrowheads: true } } as Partial<PptxElement>)}
				canEdit
				onUpdateElementStyle={() => {}}
			/>,
		);
		const selectCount = (markup.match(/<select/gu) ?? []).length;
		expect(selectCount).toBeGreaterThan(0);
		expect(markup.match(/disabled=""/gu) ?? []).toHaveLength(selectCount);
	});

	it('leaves the dropdowns enabled on an editable, unlocked connector', () => {
		const markup = renderToStaticMarkup(
			<ConnectorPanel selectedElement={connector()} canEdit onUpdateElementStyle={() => {}} />,
		);
		expect(markup).not.toContain('disabled=""');
	});
});

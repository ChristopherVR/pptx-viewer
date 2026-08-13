/**
 * Exactly one DOM node per slide element may own the element contract.
 *
 * The contract (`data-element-id` + `data-pptx-element="true"` + the shared
 * ARIA role / label) is applied by the slide canvas, which looks each element
 * up by `data-element-id`. When a leaf renderer stamped that id on its OWN root
 * INSIDE the dispatcher's already-marked wrapper, the lookup found the inner
 * node instead: it carried no marker, kept its own `role="img"` and its own
 * label, and the positioned box was drawn twice (both roots applied
 * `getContainerStyle`, so the OLE / SmartArt box was offset by its x/y twice).
 *
 * Angular has no TestBed here (see `vitest.config.ts`), so the guard reads the
 * component sources: leaf renderers that are drawn INTO a host-owned box must
 * not claim the id, and the hosts that draw that box must.
 */
import { describe, expect, it } from 'vitest';

import { componentSource } from './component-source.test-support';

const VIEWER_DIR = import.meta.dirname;

function source(file: string): string {
	return componentSource(VIEWER_DIR, file);
}

/** Renderers that fill a box their host positions, so own no element identity. */
const FILL_RENDERERS = [
	'ole-renderer.component.ts',
	'smart-art-renderer.component.ts',
	'chart-element-view.component.ts',
	'table-renderer.component.ts',
];

/** Hosts that draw the positioned, marked box for the renderers above. */
const CONTRACT_OWNERS = ['element-renderer.component.ts', 'smart-art-3d-renderer.component.ts'];

describe('element contract ownership', () => {
	it.each(FILL_RENDERERS)('%s does not claim data-element-id', (file) => {
		expect(source(file)).not.toContain('data-element-id');
	});

	it.each(FILL_RENDERERS)('%s does not position itself with getContainerStyle', (file) => {
		expect(source(file)).not.toContain('getContainerStyle');
	});

	it.each(CONTRACT_OWNERS)('%s stamps the id and the marker on the box it draws', (file) => {
		const text = source(file);
		// Either the id directly, or through `elementIdAttr()`, which is the same
		// id gated on `exposeElementId`. The miniature surfaces (thumbnail rail,
		// sorter, presenter navigator, galleries) paint EVERY slide at once and
		// turn that gate off, so an element id resolves to exactly one node in
		// the document; contract ownership on the box itself is unchanged.
		expect(text).toMatch(/\[attr\.data-element-id\]="(element\(\)\.id|elementIdAttr\(\))"/u);
		expect(text).toContain('data-pptx-element');
	});

	it('draws the OLE and SmartArt boxes from the element dispatcher', () => {
		const text = source('element-renderer.component.ts');
		// Both branches wrap their leaf renderer in the positioned, marked box.
		expect(text).toMatch(/pptx-ng-ole"[\s\S]*?\[ngStyle\]="containerStyle\(\)"/u);
		expect(text).toMatch(/pptx-ng-smartart"[\s\S]*?\[ngStyle\]="containerStyle\(\)"/u);
	});
});

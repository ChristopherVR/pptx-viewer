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
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const VIEWER_DIR = import.meta.dirname;

function source(file: string): string {
	return readFileSync(path.join(VIEWER_DIR, file), 'utf8');
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
		expect(text).toContain('[attr.data-element-id]="element().id"');
		expect(text).toContain('data-pptx-element');
	});

	it('draws the OLE and SmartArt boxes from the element dispatcher', () => {
		const text = source('element-renderer.component.ts');
		// Both branches wrap their leaf renderer in the positioned, marked box.
		expect(text).toMatch(/pptx-ng-ole"[\s\S]*?\[ngStyle\]="containerStyle\(\)"/u);
		expect(text).toMatch(/pptx-ng-smartart"[\s\S]*?\[ngStyle\]="containerStyle\(\)"/u);
	});
});

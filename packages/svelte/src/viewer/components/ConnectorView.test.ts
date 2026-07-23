import type { PptxElement } from 'pptx-viewer-core';
import { buildConnectorGeometry } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import ConnectorView from './ConnectorView.svelte';

/**
 * ConnectorView tests: assert the rendered `<marker>` reads its
 * `markerWidth`/`markerHeight` from the shared connector geometry (so `sm`/`lg`
 * arrow-size tokens scale) instead of the previous hard-coded `4`.
 */

let mounted: ReturnType<typeof mount> | undefined;

afterEach(() => {
	if (mounted) {
		void unmount(mounted);
		mounted = undefined;
	}
	document.body.innerHTML = '';
});

function render(element: PptxElement): HTMLElement {
	const target = document.createElement('div');
	document.body.appendChild(target);
	mounted = mount(ConnectorView, {
		target,
		props: { element, mediaDataUrls: new Map<string, string>(), zIndex: 2 },
	});
	flushSync();
	return target;
}

function connector(shapeStyle: Record<string, unknown>): PptxElement {
	return {
		type: 'connector',
		id: 'conn-1',
		x: 0,
		y: 0,
		width: 120,
		height: 0,
		shapeStyle,
	} as unknown as PptxElement;
}

describe('connectorView arrow markers', () => {
	it('scales the marker size from the arrow length/width tokens', () => {
		const element = connector({
			strokeColor: '#000000',
			strokeWidth: 2,
			connectorEndArrow: 'triangle',
			connectorEndArrowLength: 'lg',
			connectorEndArrowWidth: 'lg',
		});
		// Sanity: the shared geometry derives a scaled marker (4 * 1.5 = 6).
		const geometry = buildConnectorGeometry(element, 2);
		expect(geometry.endMarker?.markerWidth).toBe(6);

		const marker = render(element).querySelector('marker');
		expect(marker).not.toBeNull();
		expect(marker?.getAttribute('markerWidth')).toBe('6');
		expect(marker?.getAttribute('markerHeight')).toBe('6');
	});
});

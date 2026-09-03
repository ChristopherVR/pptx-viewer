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

	// Shared `markerPath` flags the open chevron ('arrow') as `strokeOnly`: a
	// solid fill draws it as a filled wedge, indistinguishable from 'triangle'.
	it('renders the open-chevron "arrow" head stroke-only, not solid-filled', () => {
		const element = connector({
			strokeColor: '#123456',
			strokeWidth: 2,
			connectorEndArrow: 'arrow',
		});
		const path = render(element).querySelector('marker path');
		expect(path).not.toBeNull();
		expect(path?.getAttribute('fill')).toBe('none');
		expect(path?.getAttribute('stroke')).toBe('#123456');
	});

	it('still solid-fills a closed triangle head', () => {
		const element = connector({
			strokeColor: '#123456',
			strokeWidth: 2,
			connectorEndArrow: 'triangle',
		});
		const path = render(element).querySelector('marker path');
		expect(path).not.toBeNull();
		expect(path?.getAttribute('fill')).toBe('#123456');
		expect(path?.hasAttribute('stroke')).toBeFalsy();
	});

	it('renders connector label model font sizes as CSS pixels', () => {
		const element = {
			...connector({ strokeColor: '#123456' }),
			text: 'Label',
			textStyle: { fontSize: 64 },
			textSegments: [{ text: 'Label', style: { fontSize: 32 } }],
		} as PptxElement;
		const rendered = render(element);
		expect(
			rendered.querySelector('.pptx-svelte-connector-text-block')?.getAttribute('style'),
		).toContain('font-size: 64px');
		expect(
			rendered.querySelector('.pptx-svelte-connector-text span')?.getAttribute('style'),
		).toContain('font-size: 32px');
	});
});

/**
 * The wrapper is `pointer-events: none`, so without this stroke there is NO
 * pointer route to a connector at all and the inspector's connector card can
 * only be opened from the Elements list.
 */
describe('connectorView pointer hit target', () => {
	function hitPath(element: PptxElement): SVGPathElement {
		const path = render(element).querySelector<SVGPathElement>('.pptx-svelte-connector-hit');
		if (!path) {
			throw new Error('connector has no hit target');
		}
		return path;
	}

	it('runs a transparent, finger-wide stroke along a hairline connector', () => {
		const path = hitPath(connector({ strokeColor: '#000000', strokeWidth: 1 }));

		expect(path.getAttribute('stroke')).toBe('transparent');
		expect(path.getAttribute('stroke-width')).toBe('14');
		// The shared geometry clamps a zero-height connector's box to 1px.
		expect(path.getAttribute('d')).toBe('M0,0 L120,1');
		expect(path.getAttribute('style')).toContain('pointer-events: stroke');
	});

	it('scales the target with a thick line', () => {
		expect(hitPath(connector({ strokeWidth: 10 })).getAttribute('stroke-width')).toBe('30');
	});

	it('resolves a press on the line to the connector, not the background', () => {
		const path = hitPath(connector({ strokeWidth: 2 }));

		expect(path.closest('[data-element-id]')?.getAttribute('data-element-id')).toBe('conn-1');
	});
});

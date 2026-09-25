import type { ChartViewModel, SvgText } from 'pptx-viewer-shared';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';

import ChartSvgView from './ChartSvgView.svelte';

let cleanup: (() => void) | undefined;

afterEach(() => {
	cleanup?.();
	cleanup = undefined;
});

function rotated(text: string): SvgText {
	return {
		kind: 'text',
		x: 10,
		y: 40,
		text,
		fontSize: 8,
		fill: '#ffffff',
		textAnchor: 'middle',
		dominantBaseline: 'central',
		opacity: 0.5,
		transform: 'rotate(30, 10, 40)',
	};
}

function viewModel(): ChartViewModel {
	return {
		svgWidth: 400,
		svgHeight: 300,
		title: undefined,
		titleX: 200,
		titleY: 12,
		gridlines: [],
		axisLabels: [rotated('al')],
		zeroLine: undefined,
		categoryLabels: [rotated('cl')],
		primitives: [],
		dataLabels: [rotated('dl')],
		legend: [],
		legendX: 200,
		legendY: 292,
		legendAnchor: 'middle',
	};
}

describe('chartSvgView text transforms', () => {
	it('keeps the rotation and opacity on data, axis and category labels', () => {
		const target = document.createElement('div');
		document.body.appendChild(target);
		const component = mount(ChartSvgView, {
			target,
			props: { vm: viewModel(), preserveAspectRatio: 'none', legendItems: [] },
		});
		flushSync();
		cleanup = () => {
			void unmount(component);
			target.remove();
		};
		for (const text of ['dl', 'al', 'cl']) {
			const node = [...target.querySelectorAll('text')].find((t) => t.textContent === text);
			expect(node?.getAttribute('transform')).toBe('rotate(30, 10, 40)');
			expect(node?.getAttribute('opacity')).toBe('0.5');
		}
	});
});

describe('chartSvgView gradient defs (COM: charts-com.pptx slide 23)', () => {
	it('renders linear and radial gradient defs with their stops', () => {
		const target = document.createElement('div');
		document.body.appendChild(target);
		const component = mount(ChartSvgView, {
			target,
			props: {
				vm: {
					...viewModel(),
					areaFill: 'url(#g-rad)',
					defs: [
						{
							kind: 'linearGradient',
							id: 'g-lin',
							x1: 0.5,
							y1: 0,
							x2: 0.5,
							y2: 1,
							stops: [
								{ offset: 0, color: '#ff0000' },
								{ offset: 1, color: '#0000ff' },
							],
						},
						{
							kind: 'radialGradient',
							id: 'g-rad',
							cx: 0.5,
							cy: 0.5,
							r: 0.7,
							stops: [
								{ offset: 0, color: '#595959' },
								{ offset: 1, color: '#262626' },
							],
						},
					],
				},
				preserveAspectRatio: 'none',
				legendItems: [],
			},
		});
		flushSync();
		cleanup = () => {
			void unmount(component);
			target.remove();
		};
		expect(target.querySelector('linearGradient#g-lin')?.getAttribute('y2')).toBe('1');
		expect(target.querySelectorAll('radialGradient#g-rad stop')).toHaveLength(2);
	});
});

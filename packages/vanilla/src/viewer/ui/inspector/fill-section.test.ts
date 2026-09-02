import { describe, expect, it, vi } from 'vitest';

import { createFillSection } from './fill-section';
import type { InspectorHandlers, InspectorState } from './types';

function baseState(overrides: Partial<InspectorState> = {}): InspectorState {
	return {
		hasSelection: true,
		canShape: true,
		fillColor: '#4f86ff',
		strokeColor: '#1e3a8a',
		strokeWidth: 1,
		fillOpacity: 1,
		strokeOpacity: 1,
		gradientEnabled: false,
		gradient: { type: 'linear', angle: 90, stops: [] },
		shapeStyle: undefined,
		...overrides,
	} as unknown as InspectorState;
}

function mount() {
	const handlers = {
		setShapeFill: vi.fn(),
		setShapeStroke: vi.fn(),
		setShapeStrokeWidth: vi.fn(),
		setFillOpacity: vi.fn(),
		setStrokeOpacity: vi.fn(),
		setGradientFill: vi.fn(),
		updateGradientStop: vi.fn(),
		removeGradientStop: vi.fn(),
		addGradientStop: vi.fn(),
		setShapeStyle: vi.fn(),
		setShapeType: vi.fn(),
		pushRecentColor: vi.fn(),
	} as unknown as InspectorHandlers;
	const section = createFillSection(
		document,
		(key) => key,
		(label) => {
			const el = document.createElement('section');
			el.setAttribute('aria-label', label);
			return el;
		},
		handlers,
	);
	return { section, handlers };
}

describe('createFillSection pattern-fill panel', () => {
	it('is hidden until the shape is in pattern fill mode', () => {
		const { section } = mount();
		section.update(baseState());
		const panel = section.el.querySelector('.pptxv-inspector-pattern') as HTMLElement;
		expect(panel.hidden).toBeTruthy();
	});

	it('shows the preset + background controls when shapeStyle.fillMode is "pattern"', () => {
		const { section } = mount();
		section.update(
			baseState({
				shapeStyle: {
					fillPatternPreset: 'cross',
					fillPatternBackgroundColor: '#123456',
					fillMode: 'pattern',
				},
			} as unknown as Partial<InspectorState>),
		);
		const panel = section.el.querySelector('.pptxv-inspector-pattern') as HTMLElement;
		expect(panel.hidden).toBeFalsy();
		const select = panel.querySelector('select') as HTMLSelectElement;
		expect(select.value).toBe('cross');
	});

	it('turning the pattern toggle on writes fillMode: pattern with a default preset', () => {
		const { section, handlers } = mount();
		section.update(baseState());
		const toggle = section.el.querySelector('.pptxv-inspector-pattern')
			?.previousElementSibling as HTMLElement;
		const checkbox = toggle.querySelector('input[type="checkbox"]') as HTMLInputElement;

		checkbox.checked = true;
		checkbox.dispatchEvent(new Event('change'));

		expect(handlers.setShapeStyle).toHaveBeenCalledWith(
			expect.objectContaining({ fillMode: 'pattern', fillPatternPreset: 'pct20' }),
		);
	});

	it('turning the pattern toggle off reverts to a solid fill', () => {
		const { section, handlers } = mount();
		section.update(
			baseState({
				shapeStyle: { fillMode: 'pattern', fillPatternPreset: 'cross' },
			} as unknown as Partial<InspectorState>),
		);
		const toggle = section.el.querySelector('.pptxv-inspector-pattern')
			?.previousElementSibling as HTMLElement;
		const checkbox = toggle.querySelector('input[type="checkbox"]') as HTMLInputElement;

		checkbox.checked = false;
		checkbox.dispatchEvent(new Event('change'));

		expect(handlers.setShapeFill).toHaveBeenCalledWith('#4f86ff');
	});

	it('changing the preset select writes fillPatternPreset', () => {
		const { section, handlers } = mount();
		section.update(
			baseState({
				shapeStyle: { fillMode: 'pattern', fillPatternPreset: 'cross' },
			} as unknown as Partial<InspectorState>),
		);
		const select = section.el.querySelector('.pptxv-inspector-pattern select') as HTMLSelectElement;

		select.value = 'dotGrid';
		select.dispatchEvent(new Event('change'));

		expect(handlers.setShapeStyle).toHaveBeenCalledWith({
			fillMode: 'pattern',
			fillPatternPreset: 'dotGrid',
		});
	});
});

// B6 (A1/A2): "Recent colours" rows under the fill and stroke pickers.
describe('createFillSection recent-colours rows', () => {
	it('renders one recent-colours row per picker, hidden until there are entries', () => {
		const { section } = mount();
		section.update(baseState());

		const rows = section.el.querySelectorAll('[data-testid="pptx-color-recent"]');
		expect(rows).toHaveLength(2);
		for (const row of rows) {
			expect((row as HTMLElement).hidden).toBeTruthy();
		}

		section.update(baseState({ recentColors: ['#112233'] }));
		for (const row of section.el.querySelectorAll('[data-testid="pptx-color-recent"]')) {
			expect((row as HTMLElement).hidden).toBeFalsy();
		}
	});

	it('commits a fill pick through setShapeFill, and a stroke pick through setShapeStroke', () => {
		const { section, handlers } = mount();
		section.update(baseState({ recentColors: ['#112233'] }));

		const [fillRow, strokeRow] = Array.from(
			section.el.querySelectorAll<HTMLElement>('[data-testid="pptx-color-recent"]'),
		);
		fillRow.querySelector<HTMLButtonElement>('.pptxv-swatch')!.click();
		expect(handlers.setShapeFill).toHaveBeenCalledExactlyOnceWith('#112233');
		expect(handlers.setShapeStroke).not.toHaveBeenCalled();

		strokeRow.querySelector<HTMLButtonElement>('.pptxv-swatch')!.click();
		expect(handlers.setShapeStroke).toHaveBeenCalledExactlyOnceWith('#112233');
	});

	it('disables both rows when the shape cannot be formatted', () => {
		const { section } = mount();
		section.update(baseState({ canShape: false, recentColors: ['#112233'] }));

		for (const row of section.el.querySelectorAll('[data-testid="pptx-color-recent"]')) {
			expect(row.querySelector<HTMLButtonElement>('.pptxv-swatch')!.disabled).toBeTruthy();
		}
	});
});

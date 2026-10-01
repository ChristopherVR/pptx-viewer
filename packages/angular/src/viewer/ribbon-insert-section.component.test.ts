/**
 * The Insert tab adapter routes typed shared intents to the editor service, the
 * dialog service and its outputs. No Angular TestBed (see `vitest.config.ts`):
 * the component is instantiated directly with stubbed services and signals.
 */
import { Injector, runInInjectionContext, signal } from '@angular/core';
import type { InputSignal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { describe, expect, it, vi } from 'vitest';

import { EditorStateService } from './editor-state.service';
import { RibbonInsertSectionComponent } from './ribbon-insert-section.component';
import { ViewerDialogsService } from './viewer-dialogs.service';

function create(hasSelection = false) {
	const addElement = vi.fn();
	const showHeaderFooter = { set: vi.fn() };
	const section = runInInjectionContext(
		Injector.create({
			providers: [
				{
					provide: EditorStateService,
					useValue: { addElement, hasSelection: () => hasSelection },
				},
				{ provide: TranslateService, useValue: { instant: (key: string) => key } },
				{ provide: ViewerDialogsService, useValue: { showHeaderFooter } },
			],
		}),
		() => new RibbonInsertSectionComponent(),
	);
	Object.assign(section, { canEdit: signal(true) as unknown as InputSignal<boolean> });
	return { section, addElement, showHeaderFooter };
}
const intent = (detail: unknown) => new CustomEvent('insert-request', { detail });
const request = (section: RibbonInsertSectionComponent, detail: unknown) =>
	(section as unknown as { request(event: Event): void }).request(intent(detail));

describe('ribbonInsertSectionComponent', () => {
	it('inserts text boxes, tables, the staged shape and the chart through the editor', () => {
		const { section, addElement } = create();
		request(section, { kind: 'command', value: 'textBox' });
		request(section, { kind: 'command', value: 'table' });
		request(section, { kind: 'shape', value: 'star5' });
		request(section, { kind: 'chart', value: 'pie' });
		expect(addElement.mock.calls.map(([slide, element]) => [slide, element.type])).toStrictEqual([
			[0, 'text'],
			[0, 'table'],
			[0, 'shape'],
			[0, 'chart'],
		]);
	});

	it('maps dialog commands to outputs and the dialog service', () => {
		const { section, showHeaderFooter } = create();
		const smartArt = vi.spyOn(section.openSmartArtDialog, 'emit');
		const equation = vi.spyOn(section.openEquationDialog, 'emit');
		const link = vi.spyOn(section.openHyperlink, 'emit');
		for (const value of ['smartArt', 'equation', 'link', 'headerFooter']) {
			request(section, { kind: 'command', value });
		}
		expect([smartArt, equation, link].map((spy) => spy.mock.calls.length)).toStrictEqual([1, 1, 1]);
		expect(showHeaderFooter.set).toHaveBeenCalledExactlyOnceWith(true);
	});

	it('emits the staged shape and chart types back to the owning ribbon', () => {
		const { section } = create();
		const shape = vi.spyOn(section.shapeTypeChange, 'emit');
		const chart = vi.spyOn(section.chartTypeChange, 'emit');
		request(section, { kind: 'shapeType', value: 'ellipse' });
		request(section, { kind: 'chartType', value: 'line' });
		expect(shape).toHaveBeenCalledExactlyOnceWith('ellipse');
		expect(chart).toHaveBeenCalledExactlyOnceWith('line');
	});

	it('reflects controlled inputs, selection and read-only state in the shared state', () => {
		const { section } = create(true);
		Object.assign(section, {
			canEdit: signal(false),
			newShapeType: signal('star5'),
			newChartType: signal('pie'),
		});
		expect(section['view']()).toMatchObject({
			editable: false,
			hasSelection: true,
			shapeType: 'star5',
			chartKind: 'pie',
			freeformTools: [],
		});
	});
});

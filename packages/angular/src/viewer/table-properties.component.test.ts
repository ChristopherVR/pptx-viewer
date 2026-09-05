/**
 * table-properties.component.test.ts: the launcher's "create new style" action
 * (via `TableStyleEditorComponent`'s `assignStyle` output) must land on the
 * table element being edited, through the same `patchTableData` +
 * `elementChange` path every other table-properties edit uses.
 *
 * No TestBed (matching the rest of this package): constructed inside a plain
 * `Injector` context, mirroring `table-style-editor.component.test.ts`.
 */
import type { OutputEmitterRef } from '@angular/core';
import { Injector, runInInjectionContext } from '@angular/core';
import type { TablePptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { TablePropertiesComponent } from './table-properties.component';

function tableElement(): TablePptxElement {
	return {
		id: 't1',
		type: 'table',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		tableData: {
			columnWidths: [0.5, 0.5],
			rows: [{ cells: [{ text: 'a' }, { text: 'b' }] }],
		},
	} as unknown as TablePptxElement;
}

function harness(element: TablePptxElement) {
	const injector = Injector.create({ providers: [] });
	const component = runInInjectionContext(injector, () => new TablePropertiesComponent());
	(component as unknown as { element: () => TablePptxElement }).element = () => element;
	return component;
}

describe('tablePropertiesComponent', () => {
	it('assigns a newly-created style id to the table via elementChange', () => {
		const component = harness(tableElement());
		let emitted: TablePptxElement | undefined;
		vi.spyOn(
			component.elementChange as OutputEmitterRef<TablePptxElement>,
			'emit',
		).mockImplementation((value) => {
			emitted = value;
		});

		component['onAssignStyle']('{NEW-STYLE-GUID}');

		expect(emitted?.tableData?.tableStyleId).toBe('{NEW-STYLE-GUID}');
	});
});

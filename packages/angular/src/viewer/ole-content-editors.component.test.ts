/**
 * ole-content-editors.component.test.ts: the three per-kind OLE "Edit
 * content" tab editors (`OleSheetGridEditorComponent`,
 * `OleDocumentEditorComponent`, `OleDeckEditorComponent`), extracted from
 * `ole-editor-dialog.component.ts` for the 300-LOC file-size limit.
 *
 * None of the three declares an `effect()`, so (unlike
 * `ole-editor-dialog.component.test.ts`) a bare injector with no scheduler
 * stubs is enough, matching `table-cell-formatting.component.test.ts`'s
 * harness. Each only commits its edit on blur when the value actually
 * changed; that "no-op on unchanged blur" behaviour is the one piece of
 * logic worth pinning outside the template itself.
 */
import { Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it } from 'vitest';

import { OleDeckEditorComponent } from './ole-deck-editor.component';
import { OleDocumentEditorComponent } from './ole-document-editor.component';
import { OleSheetGridEditorComponent } from './ole-sheet-grid-editor.component';

function blurEvent(tag: 'input' | 'textarea', value: string): Event {
	const el = document.createElement(tag);
	el.value = value;
	return { target: el } as unknown as Event;
}

function create<T>(factory: () => T): T {
	return runInInjectionContext(Injector.create({ providers: [] }), factory);
}

describe('oleSheetGridEditorComponent', () => {
	it('emits a cellEdit only when the blurred value differs from the loaded one', () => {
		const component = create(() => new OleSheetGridEditorComponent());
		const emitted: unknown[] = [];
		component.cellEdit.subscribe((value) => emitted.push(value));

		component['onBlur'](0, 1, '10', blurEvent('input', '10'));
		expect(emitted).toHaveLength(0);

		component['onBlur'](0, 1, '10', blurEvent('input', '250'));
		expect(emitted).toStrictEqual([{ row: 0, col: 1, value: '250' }]);
	});
});

describe('oleDocumentEditorComponent', () => {
	it('emits a paragraphEdit only when the blurred text differs from the loaded one', () => {
		const component = create(() => new OleDocumentEditorComponent());
		const emitted: unknown[] = [];
		component.paragraphEdit.subscribe((value) => emitted.push(value));

		component['onBlur'](2, 'Hello', blurEvent('textarea', 'Hello'));
		expect(emitted).toHaveLength(0);

		component['onBlur'](2, 'Hello', blurEvent('textarea', 'Goodbye'));
		expect(emitted).toStrictEqual([{ index: 2, text: 'Goodbye' }]);
	});
});

describe('oleDeckEditorComponent', () => {
	it('emits a deckElementEdit only when the blurred text differs from the loaded one', () => {
		const component = create(() => new OleDeckEditorComponent());
		const emitted: unknown[] = [];
		component.deckElementEdit.subscribe((value) => emitted.push(value));

		component['onBlur'](1, 'el-1', 'Intro', blurEvent('input', 'Intro'));
		expect(emitted).toHaveLength(0);

		component['onBlur'](1, 'el-1', 'Intro', blurEvent('input', 'Welcome'));
		expect(emitted).toStrictEqual([{ slideIndex: 1, elementId: 'el-1', text: 'Welcome' }]);
	});
});

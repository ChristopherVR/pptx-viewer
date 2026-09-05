/**
 * inspector-panel-table-style.test.ts: the table style DEFINITION editor's
 * "Edit style..." panel was wired down to `TablePropertiesComponent` (W4-E)
 * but nothing above it ever supplied `tableStyleMap` or handled
 * `tableStyleMapChange`/`deleteTableStyle`, so the button never rendered and
 * an edit had nowhere to land. This proves `InspectorPanelComponent`'s two
 * handlers actually write the loader's `tableStyleMap`/`tableStylesToDelete`
 * signals (the same signals `table-renderer.component.ts` reads and
 * `LoadContentService.saveSlides` forwards via `tableStyleSaveOptions`).
 *
 * No TestBed (matching the rest of this package): constructed inside a plain
 * `Injector` context, mirroring `table-style-editor.component.test.ts`.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { Injector, runInInjectionContext } from '@angular/core';
import type { ParsedTableStyleMap } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { EditorStateService } from './editor-state.service';
import { InspectorPanelComponent } from './inspector-panel.component';
import { IsMobileService } from './is-mobile';
import { LoadContentService } from './load-content.service';
import { RecentColorsService } from './recent-colors.service';

function mapWith(...ids: string[]): ParsedTableStyleMap {
	const map: ParsedTableStyleMap = {};
	for (const id of ids) {
		map[id] = { styleId: id, styleName: id };
	}
	return map;
}

/** A minimal settable-signal stand-in, enough for `component()` / `.set(v)`. */
function fakeSignal<T>(initial: T): { (): T; set(value: T): void } {
	let value = initial;
	const read = (() => value) as { (): T; set(value: T): void };
	read.set = (next: T) => {
		value = next;
	};
	return read;
}

function harness(tableStyleMap: ParsedTableStyleMap | undefined, tableStylesToDelete: string[]) {
	const loaderTableStyleMap = fakeSignal(tableStyleMap);
	const loaderTableStylesToDelete = fakeSignal(tableStylesToDelete);
	const fakeLoader = {
		tableStyleMap: loaderTableStyleMap,
		tableStylesToDelete: loaderTableStylesToDelete,
	} as unknown as LoadContentService;

	const injector = Injector.create({
		providers: [
			{ provide: LoadContentService, useValue: fakeLoader },
			EditorStateService,
			IsMobileService,
			RecentColorsService,
		],
	});
	const component = runInInjectionContext(injector, () => new InspectorPanelComponent());
	const editor = injector.get(EditorStateService);
	return { component, editor, loaderTableStyleMap, loaderTableStylesToDelete };
}

describe('inspectorPanelComponent table style map handlers', () => {
	it('onTableStyleMapChange writes the loader signal the table renderer reads', () => {
		const { component, editor, loaderTableStyleMap, loaderTableStylesToDelete } = harness(
			mapWith('a'),
			[],
		);

		const nextMap = mapWith('a', 'b');
		component['onTableStyleMapChange'](nextMap);

		expect(loaderTableStyleMap()).toStrictEqual(nextMap);
		expect(loaderTableStylesToDelete()).toStrictEqual([]);
		expect(editor.dirty()).toBeTruthy();
	});

	it('onTableStyleMapChange drops a pending delete when the id reappears', () => {
		const { component, loaderTableStylesToDelete } = harness(mapWith('a'), ['b']);

		component['onTableStyleMapChange'](mapWith('a', 'b'));

		expect(loaderTableStylesToDelete()).toStrictEqual([]);
	});

	it('onDeleteTableStyle removes the entry and records the id for save-time deletion', () => {
		const { component, editor, loaderTableStyleMap, loaderTableStylesToDelete } = harness(
			mapWith('a', 'b'),
			[],
		);

		component['onDeleteTableStyle']('a');

		expect(loaderTableStyleMap()).toStrictEqual(mapWith('b'));
		expect(loaderTableStylesToDelete()).toStrictEqual(['a']);
		expect(editor.dirty()).toBeTruthy();
	});

	it('is a no-op without a loader (standalone thumbnail/export render context)', () => {
		const injector = Injector.create({
			providers: [
				{ provide: LoadContentService, useValue: null },
				EditorStateService,
				IsMobileService,
				RecentColorsService,
			],
		});
		const component = runInInjectionContext(injector, () => new InspectorPanelComponent());
		const editor = injector.get(EditorStateService);

		expect(() => component['onTableStyleMapChange'](mapWith('a'))).not.toThrow();
		expect(() => component['onDeleteTableStyle']('a')).not.toThrow();
		expect(editor.dirty()).toBeFalsy();
	});

	it('shows the table data and table style sections expanded, as the other four bindings do', () => {
		// The shared e2e spec (`e2e/table-style-editor.spec.ts`) expects the
		// "Edit style..." button to be visible as soon as a table is selected;
		// a closed `<details>` hid it in Angular alone.
		const source = readFileSync(path.join(__dirname, 'inspector-panel.component.ts'), 'utf8');
		const tableBlock = source.slice(
			source.indexOf('@if (tableEl(); as t) {'),
			source.indexOf('<pptx-table-cell-formatting'),
		);
		const detailsTags = tableBlock.match(/<details[^>]*>/gu) ?? [];
		expect(detailsTags).toHaveLength(3);
		for (const tag of detailsTags) {
			expect(tag).toContain(' open');
		}
	});
});

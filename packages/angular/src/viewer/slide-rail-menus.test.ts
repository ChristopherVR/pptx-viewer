/**
 * #397: the section-header menu, the sorter tile menu and the rail's action row
 * are one feature across all five bindings. The command lists come from
 * `pptx-viewer-shared`; these tests pin that Angular renders and routes them.
 *
 * No TestBed (see `vitest.config.ts`): components are instantiated directly
 * with their inputs stubbed as signals, and template contracts are read from
 * the source.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { ElementRef, Injector, runInInjectionContext, signal } from '@angular/core';
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { SectionContextMenuComponent } from './section-context-menu.component';
import { SlideSorterOverlayComponent } from './slide-sorter-overlay.component';

const read = (file: string): string => readFileSync(path.join(import.meta.dirname, file), 'utf8');

const make = <T>(factory: () => T): T =>
	runInInjectionContext(
		Injector.create({
			providers: [{ provide: ElementRef, useValue: new ElementRef(document.createElement('div')) }],
		}),
		factory,
	);

const slides = (count = 3): PptxSlide[] =>
	Array.from({ length: count }, (_unused, index) => ({
		id: `s${index + 1}`,
		rId: `rId${index + 1}`,
		slideNumber: index + 1,
		elements: [],
	})) as PptxSlide[];

describe('angular section context menu', () => {
	it('is a role="menu" with roled items built from the shared list', () => {
		const source = read('section-context-menu.component.ts');
		expect(source).toContain('data-pptx-context-menu="true"');
		expect(source).toContain('data-pptx-section-context-menu="true"');
		expect(source).toContain('role="menu"');
		expect(source).toContain('buildSectionContextMenuEntries');
		expect(source.match(/<button\b/gu)?.length).toBe(source.match(/role="menuitem"/gu)?.length);
	});

	it('gates Move Up on the first section and Move Down on the last', () => {
		const menu = make(() => new SectionContextMenuComponent());
		Object.assign(menu, { sectionIndex: signal(0), totalSections: signal(2) });
		const entries = menu['entries']();
		expect(entries.map((entry) => entry.id)).toStrictEqual([
			'rename',
			'delete',
			'move-up',
			'move-down',
			'add-after',
		]);
		expect(entries.find((entry) => entry.id === 'move-up')?.disabled).toBeTruthy();
		expect(entries.find((entry) => entry.id === 'move-down')?.disabled).toBeFalsy();
	});

	it('emits the chosen command and closes', () => {
		const menu = make(() => new SectionContextMenuComponent());
		const commands: string[] = [];
		let closed = 0;
		menu.command.subscribe((id) => commands.push(id));
		menu.closed.subscribe(() => (closed += 1));
		menu['run']('add-after');
		expect(commands).toStrictEqual(['add-after']);
		expect(closed).toBe(1);
	});
});

describe('angular slides panel', () => {
	const source = read('slides-panel.component.html');

	it('has no per-thumbnail action toolbar and keeps Add Slide as the footer action', () => {
		expect(source).not.toContain('pptx-ng-spanel-actions');
		expect(source).not.toContain('onMoveUp');
		expect(source.match(/<footer[\s\S]*?<\/footer>/u)?.[0].match(/<button\b/gu)).toHaveLength(1);
	});

	it('reorders by drag and drop and opens the section menu on a header right-click', () => {
		expect(source).toContain('(dragstart)="onDragStart($event, i)"');
		expect(source).toContain('(drop)="onDrop($event, i)"');
		expect(source).toContain('data-pptx-chrome="section-header"');
		expect(source).toContain('(contextmenu)="item.section && onSectionContextMenu');
		expect(source).toContain('<pptx-section-context-menu');
	});

	it('renames inline instead of opening a browser prompt', () => {
		expect(read('slides-panel.component.ts')).not.toContain('window.prompt');
		expect(source).toContain('class="pptx-ng-section-rename"');
	});
});

describe('angular slide sorter menu', () => {
	function sorter(slideList: PptxSlide[] = slides()) {
		const overlay = make(() => new SlideSorterOverlayComponent());
		Object.assign(overlay, { slides: signal(slideList), canEdit: signal(true) });
		const duplicated: number[] = [];
		const hidden: number[] = [];
		const deleted: number[] = [];
		overlay.duplicateSlide.subscribe((index) => duplicated.push(index));
		overlay.toggleHiddenSlide.subscribe((index) => hidden.push(index));
		overlay.deleteSlide.subscribe((index) => deleted.push(index));
		const open = (index: number): void =>
			overlay.onThumbContextMenu(
				{ preventDefault: () => undefined, clientX: 5, clientY: 5 } as MouseEvent,
				index,
			);
		return { overlay, open, duplicated, hidden, deleted };
	}

	it('offers the shared list and tags each tile for cross-binding tests', () => {
		const { overlay, open } = sorter();
		open(1);
		expect(overlay.menuEntries().map((entry) => entry.id)).toStrictEqual([
			'copy',
			'duplicate',
			'toggle-hidden',
			'delete',
		]);
		const html = read('slide-sorter-overlay.component.html');
		expect(html).toContain('data-pptx-chrome="sorter-tile"');
		expect(html).toContain('data-pptx-sorter-context-menu="true"');
		expect(html).toContain('role="menu"');
	});

	it('offers Paste only after Copy and pastes a copy of the copied slide', () => {
		const { overlay, open, duplicated } = sorter();
		open(1);
		overlay.runMenuCommand('copy');
		open(2);
		expect(overlay.menuEntries().map((entry) => entry.id)).toContain('paste');
		overlay.runMenuCommand('paste');
		expect(duplicated).toStrictEqual([1]);
	});

	it('routes Hide/Show and Delete to the right-clicked slide', () => {
		const { overlay, open, hidden, deleted } = sorter();
		open(2);
		overlay.runMenuCommand('toggle-hidden');
		open(0);
		overlay.runMenuCommand('delete');
		expect(hidden).toStrictEqual([2]);
		expect(deleted).toStrictEqual([0]);
	});

	it('shows Show Slides for a hidden slide and refuses to delete the only slide', () => {
		const hiddenSlide = { ...slides(1)[0], hidden: true } as PptxSlide;
		const { overlay, open } = sorter([hiddenSlide]);
		open(0);
		const entries = overlay.menuEntries();
		expect(entries.find((entry) => entry.id === 'toggle-hidden')?.labelKey).toBe(
			'pptx.slideSorter.contextMenu.showSlides',
		);
		expect(entries.find((entry) => entry.id === 'delete')?.disabled).toBeTruthy();
	});
});

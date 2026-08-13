/**
 * ribbon-design-section.component.test.ts: pins where the Design tab's two
 * mis-routed commands go.
 *
 * "Edit Theme" and "Slide Size" both emitted `info`, which opens the Document
 * Properties dialog: right label, unrelated dialog, and no way for a user to
 * reach either real surface from the tab that names it. Both surfaces already
 * existed (the theme editor inside the theme gallery, the SLIDE SIZE card in
 * the inspector's deck panel), so each command now has its own output.
 *
 * This package has no TestBed (see `vitest.config.ts`), and the defect lived in
 * template wiring rather than in a class, so the guard reads the component
 * sources the way `editor-context-menu.contract.test.ts` does.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it } from 'vitest';

import { RibbonDesignSectionComponent } from './ribbon-design-section.component';

function source(file: string): string {
	return readFileSync(path.join(import.meta.dirname, file), 'utf8');
}

const DESIGN = source('ribbon-design-section.component.ts');
const VIEWER = source('power-point-viewer.component.ts');

/** The `<button>` block whose label is the given translation key. */
function buttonFor(labelKey: string): string {
	const match = DESIGN.match(new RegExp(`<button[^]*?${labelKey}[^]*?</button>`, 'u'));
	expect(match, `a Design button labelled ${labelKey} must exist`).not.toBeNull();
	return match?.[0] ?? '';
}

describe('design ribbon tab routing', () => {
	it('gives Edit Theme and Slide Size their own outputs', () => {
		const section = runInInjectionContext(
			Injector.create({ providers: [] }),
			() => new RibbonDesignSectionComponent(),
		);
		let themeEdits = 0;
		let sizeOpens = 0;
		section.editTheme.subscribe(() => themeEdits++);
		section.openSlideSize.subscribe(() => sizeOpens++);

		section.editTheme.emit();
		section.openSlideSize.emit();

		expect(themeEdits).toBe(1);
		expect(sizeOpens).toBe(1);
	});

	it('no longer routes anything on this tab to the Document Properties dialog', () => {
		expect(DESIGN).not.toContain('info.emit()');
		expect(DESIGN).not.toContain('readonly info');
	});

	it('sends Edit Theme to the theme editor', () => {
		expect(buttonFor('pptx.ribbon.editTheme')).toContain('(click)="editTheme.emit()"');
	});

	it('sends Slide Size to the slide-size control', () => {
		expect(buttonFor('pptx.ribbon.slideSize')).toContain('(click)="openSlideSize.emit()"');
	});

	it('has the host open the gallery in customise mode for Edit Theme', () => {
		expect(VIEWER).toContain('(editTheme)="onEditTheme()"');
		expect(VIEWER).toContain('[startCustomizing]="themeEditorRequested()"');
		const handler = VIEWER.match(/protected onEditTheme\(\): void \{([^]*?)\n\t\}/u)?.[1] ?? '';
		expect(handler).toContain('this.themeEditorRequested.set(true)');
		expect(handler).toContain('this.themeGallery.showThemeGallery.set(true)');
	});

	it('has the host surface the inspector deck panel for Slide Size', () => {
		expect(VIEWER).toContain('(openSlideSize)="onOpenSlideSize()"');
		const handler = VIEWER.match(/protected onOpenSlideSize\(\): void \{([^]*?)\n\t\}/u)?.[1] ?? '';
		// The SLIDE SIZE card lives in the no-selection deck panel, so the
		// selection has to go before the panel is opened or the element
		// inspector shows instead.
		expect(handler).toContain('this.editor.clearSelection()');
		expect(handler).toContain('this.inspectorPanel.openFormatPanel()');
		expect(handler).not.toContain('showProperties');
	});
});

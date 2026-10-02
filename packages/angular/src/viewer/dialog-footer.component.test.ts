import { signal } from '@angular/core';
import type { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { translationsEn } from '../../../shared/src/i18n';
import { registerPptxWebControls } from '../../../shared/src/web-components';
import { componentSource } from './component-source.test-support';
import { DialogFooterComponent } from './dialog-footer.component';
import { PasteOptionsToolbarComponent } from './paste-options-toolbar.component';

beforeAll(() => {
	TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
	registerPptxWebControls();
});
afterEach(() => {
	TestBed.resetTestingModule();
	document.body.replaceChildren();
});

function open<T>(component: Type<T>, values: Record<string, unknown>) {
	TestBed.resetTestingModule();
	TestBed.configureTestingModule({
		imports: [component],
		providers: [provideTranslateService({ fallbackLang: 'en' })],
	});
	// The Vitest JIT build does not wire signal inputs, so declare them and hand each
	// field a plain signal.
	TestBed.overrideComponent(component, { add: { inputs: Object.keys(values) } });
	const fixture = TestBed.createComponent(component);
	for (const [name, value] of Object.entries(values)) {
		fixture.componentRef.setInput(name, signal(value));
	}
	const translate = TestBed.inject(TranslateService);
	translate.setTranslation('en', translationsEn);
	translate.use('en');
	fixture.detectChanges();
	return fixture;
}

const footerButtons = (root: ParentNode) =>
	Array.from(root.querySelector('pptx-ui-dialog-footer')!.shadowRoot!.querySelectorAll('button'));

describe('dialogFooterComponent adapter', () => {
	it('translates action keys and emits the activated id', () => {
		const fixture = open(DialogFooterComponent, {
			actions: [
				{ id: 'cancel', labelKey: 'pptx.common.cancel' },
				{ id: 'ok', labelKey: 'pptx.common.ok', variant: 'primary' },
			],
		});
		const seen: string[] = [];
		fixture.componentInstance.action.subscribe((id) => seen.push(id));
		const buttons = footerButtons(fixture.nativeElement as HTMLElement);
		expect(buttons.map((b) => b.textContent)).toStrictEqual(['Cancel', 'OK']);
		expect(buttons[1].className).toBe('primary');
		buttons[1].click();
		expect(seen).toStrictEqual(['ok']);
	});
});

// The Vitest JIT build cannot wire the required signal inputs of the composed
// ModalDialogComponent, so the dialogs are guarded at source level (the same
// technique as the other dialog tests in this package).
describe('dialogs on the shared footer', () => {
	const cases: [string, string, string[]][] = [
		['keep-annotations-dialog', 'KeepAnnotationsDialogComponent', ["id: 'discard'", "id: 'keep'"]],
		[
			'signature-stripped-dialog',
			'SignatureStrippedDialogComponent',
			["id: 'confirm'", "variant: 'warning'"],
		],
		['paste-special-dialog', 'PasteSpecialDialogComponent', ["id: 'ok'", "variant: 'primary'"]],
		['autosave-recovery-dialog', 'AutosaveRecoveryDialogComponent', ["id: 'restore'", 'disabled']],
	];

	it.each(cases)('%s renders its actions through pptx-dialog-footer', (file, _name, markers) => {
		const source = componentSource(import.meta.dirname, `${file}.component.ts`);
		expect(source).toContain('<pptx-dialog-footer');
		expect(source).toContain('DialogFooterComponent');
		expect(source).not.toContain('<button');
		for (const marker of markers) {
			expect(source).toContain(marker);
		}
	});
});

describe('pasteOptionsToolbarComponent adapter', () => {
	it('anchors the shared strip to the pasted element and emits the chosen format', async () => {
		const viewport = document.createElement('div');
		viewport.setAttribute('data-pptx-viewport', '');
		const pasted = document.createElement('div');
		pasted.setAttribute('data-element-id', 'pasted-1');
		pasted.getBoundingClientRect = () => ({ right: 300, bottom: 200 }) as DOMRect;
		viewport.append(pasted);
		document.body.append(viewport);
		const fixture = open(PasteOptionsToolbarComponent, { elementId: 'pasted-1' });
		await new Promise<void>((resolve) => {
			requestAnimationFrame(() => resolve());
		});
		fixture.detectChanges();
		const host = (fixture.nativeElement as HTMLElement).querySelector('pptx-ui-paste-options')!;
		expect(host.hasAttribute('data-pptx-paste-options')).toBeTruthy();
		expect((host as HTMLElement).style.left).toBe('304px');
		const seen: string[] = [];
		fixture.componentInstance.choose.subscribe((format) => seen.push(format));
		host.shadowRoot!.querySelectorAll('button')[2].click();
		expect(seen).toStrictEqual(['picture']);
	});
});

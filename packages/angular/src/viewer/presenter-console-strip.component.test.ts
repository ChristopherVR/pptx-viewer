/**
 * The Angular adapter around the shared `pptx-ui-presenter-console`: the strip's
 * inventory, names and pressed state are tested in `pptx-viewer-shared`; this
 * drives what a press does to the presenter snapshot.
 */
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { translationsEn } from '../../../shared/src/i18n';
import { registerPptxWebControls } from '../../../shared/src/web-components';
import type { PresentationSnapshot } from '../internal/shared';
import { PresenterConsoleStripComponent } from './presenter-console-strip.component';

beforeAll(() => {
	TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting());
	registerPptxWebControls();
});
afterEach(() => TestBed.resetTestingModule());

const BASE: PresentationSnapshot = {
	slideIndex: 0,
	buildStep: 0,
	sequence: 0,
	blackout: 'none',
	paused: false,
	elapsedMs: 0,
};

function open(snapshot: Partial<PresentationSnapshot> = {}, audienceOpen = false) {
	TestBed.resetTestingModule();
	TestBed.configureTestingModule({
		imports: [PresenterConsoleStripComponent],
		providers: [provideTranslateService({ fallbackLang: 'en' })],
	});
	const values = {
		snapshot: { ...BASE, ...snapshot },
		audienceOpen,
	};
	TestBed.overrideComponent(PresenterConsoleStripComponent, {
		add: { inputs: Object.keys(values) },
	});
	const fixture = TestBed.createComponent(PresenterConsoleStripComponent);
	for (const [name, value] of Object.entries(values)) {
		fixture.componentRef.setInput(name, signal(value));
	}
	const translate = TestBed.inject(TranslateService);
	translate.setTranslation('en', translationsEn);
	translate.use('en');
	fixture.detectChanges();
	const host = (fixture.nativeElement as HTMLElement).querySelector('pptx-ui-presenter-console')!;
	const control = (id: string) =>
		host.shadowRoot!.querySelector<HTMLButtonElement>(`[data-pptx-presenter-control="${id}"]`)!;
	const patches: Partial<PresentationSnapshot>[] = [];
	fixture.componentInstance.patch.subscribe((patch) => patches.push(patch));
	return { fixture, host, control, patches };
}

describe('presenterConsoleStripComponent adapter', () => {
	it('names the strip from the dictionary and reflects the snapshot as pressed state', () => {
		const { host, control } = open({
			blackout: 'black',
			pointer: { tool: 'pen', x: 0.5, y: 0.5, color: '#ef4444' },
		});
		expect(host.hasAttribute('data-pptx-presenter-toolbar')).toBeTruthy();
		expect(control('zoom-in').getAttribute('aria-label')).toBe('Zoom In');
		expect(control('pen').getAttribute('aria-pressed')).toBe('true');
		expect(control('blackout-black').getAttribute('aria-pressed')).toBe('true');
		expect(control('swap-displays').disabled).toBeTruthy();
	});

	it('patches the snapshot for timer, zoom, captions and blackout presses', () => {
		const { control, patches } = open();
		for (const id of ['timer-toggle', 'timer-reset', 'zoom-in', 'zoom-reset', 'captions']) {
			control(id).click();
		}
		control('blackout-white').click();
		expect(patches[0]).toStrictEqual({ paused: true });
		expect(patches[1]).toStrictEqual({ paused: false, elapsedMs: 0 });
		expect(patches[2]?.zoom?.scale).toBeGreaterThan(1);
		expect(patches[3]).toStrictEqual({ zoom: { scale: 1, originX: 0.5, originY: 0.5 } });
		expect(patches[4]).toStrictEqual({ subtitlesVisible: true });
		expect(patches[5]).toStrictEqual({ blackout: 'white' });
	});

	it('arms a tool and disarms it on a second press', () => {
		const first = open();
		first.control('laser').click();
		expect(first.patches[0]?.pointer?.tool).toBe('laser');
		const armed = open({ pointer: { tool: 'laser', x: 0.5, y: 0.5, color: '#ef4444' } });
		armed.control('laser').click();
		expect(armed.patches[0]?.pointer?.tool).toBe('none');
	});

	it('forwards the all-slides, audience, swap and end outputs', () => {
		const { fixture, control } = open({}, true);
		const seen: string[] = [];
		fixture.componentInstance.showSlides.subscribe(() => seen.push('slides'));
		fixture.componentInstance.audience.subscribe(() => seen.push('audience'));
		fixture.componentInstance.swapDisplays.subscribe(() => seen.push('swap'));
		fixture.componentInstance.end.subscribe(() => seen.push('end'));
		control('all-slides').click();
		control('audience').click();
		control('swap-displays').click();
		control('end').click();
		expect(seen).toStrictEqual(['slides', 'audience', 'swap', 'end']);
	});
});

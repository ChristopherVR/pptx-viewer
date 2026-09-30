import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { TranslateService } from '@ngx-translate/core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { registerPptxWebControls } from '../internal/shared';
import { RibbonReviewSectionComponent } from './ribbon-review-section.component';

registerPptxWebControls();
beforeAll(() => TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting()));
afterEach(() => TestBed.resetTestingModule());
function mount() {
	TestBed.configureTestingModule({
		imports: [RibbonReviewSectionComponent],
		providers: [{ provide: TranslateService, useValue: { instant: (key: string) => key } }],
	});
	const fixture = TestBed.createComponent(RibbonReviewSectionComponent);
	fixture.componentRef.setInput('canEdit', true);
	fixture.detectChanges();
	const el = fixture.nativeElement as HTMLElement;
	const button = (id: string) =>
		el
			.querySelector(`[data-ribbon-control="review.${id}"]`)!
			.shadowRoot!.querySelector<HTMLButtonElement>('button')!;
	return { fixture, el, button };
}

describe('review shared command adapter', () => {
	it('emits the native outputs and leaves unsupported commands inert', () => {
		const { fixture, el, button } = mount();
		const spelling = vi.fn(),
			comments = vi.fn(),
			compare = vi.fn(),
			accessibility = vi.fn(),
			language = vi.fn();
		fixture.componentInstance.spellCheckChange.subscribe(spelling);
		fixture.componentInstance.comments.subscribe(comments);
		fixture.componentInstance.openCompare.subscribe(compare);
		fixture.componentInstance.a11y.subscribe(accessibility);
		fixture.componentInstance.language.subscribe(language);
		for (const id of [
			'proofing.spelling',
			'accessibility.check',
			'language.language',
			'compare.compare',
			'comments.newComment',
			'comments.showComments',
		]) {
			button(id).click();
		}
		expect(spelling).toHaveBeenCalledExactlyOnceWith(true);
		expect(accessibility).toHaveBeenCalledOnce();
		expect(language).toHaveBeenCalledOnce();
		expect(compare).toHaveBeenCalledOnce();
		expect(comments).toHaveBeenCalledTimes(2);
		expect(el.querySelectorAll('pptx-ui-ribbon-group')).toHaveLength(7);
		for (const id of [
			'proofing.thesaurus',
			'language.translate',
			'comments.delete',
			'protect.readOnly',
			'ink.hideInk',
		]) {
			expect(button(id).disabled).toBeTruthy();
		}
	});

	it('updates spelling and compare availability without replacing a focused command', () => {
		const { fixture, button } = mount();
		const focused = button('proofing.spelling');
		focused.focus();
		fixture.componentRef.setInput('spellCheckEnabled', true);
		fixture.componentRef.setInput('canEdit', false);
		fixture.detectChanges();
		expect(button('proofing.spelling')).toBe(focused);
		expect(focused.getAttribute('aria-pressed')).toBe('true');
		expect(button('compare.compare').disabled).toBeTruthy();
	});
});

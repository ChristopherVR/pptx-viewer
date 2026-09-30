import { Component, Input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BrowserTestingModule, platformBrowserTesting } from '@angular/platform-browser/testing';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createRibbonControlIcon } from '../internal/shared';
import { RibbonIconDirective } from './ribbon-icon.directive';

@Component({
	standalone: true,
	imports: [RibbonIconDirective],
	template: '<svg class="retained-class" [pptxRibbonIcon]="name"></svg>',
})
class IconHost {
	@Input()
	name = 'home.font.increaseFontSize';
}

beforeAll(() => TestBed.initTestEnvironment(BrowserTestingModule, platformBrowserTesting()));
afterEach(() => TestBed.resetTestingModule());

describe('shared ribbon artwork in Angular', () => {
	it('updates artwork through Angular binding while retaining the host class', () => {
		const fixture = TestBed.createComponent(IconHost);
		fixture.detectChanges();
		const svg = (fixture.nativeElement as HTMLElement).querySelector('svg')!;
		expect(svg.innerHTML).toBe(
			createRibbonControlIcon(document, 'home.font.increaseFontSize').innerHTML,
		);
		expect(svg.classList.contains('retained-class')).toBeTruthy();
		expect(svg.getAttribute('stroke-width')).toBe('2');
		fixture.componentRef.setInput('name', 'home.arrange.align.middle');
		fixture.detectChanges();
		expect(svg.innerHTML).toBe(
			createRibbonControlIcon(document, 'home.arrange.align.middle').innerHTML,
		);
		expect(svg.style.rotate).toBe('90deg');
	});
});

/**
 * ribbon-customization-style.directive.ts: renders the viewer's ONE ribbon
 * customisation `<style>` element (group- and control-level hiding).
 *
 * The stylesheet text is shared `ribbonCustomizationCss(resolved, scope)`, so
 * which markup a hidden id removes is decided once for all five bindings; the
 * viewer root carries the matching `data-pptx-ribbon-scope` token so two
 * viewers on one page never hide each other's controls.
 *
 * A directive that owns a real `<style>` node because Angular strips
 * `<style>` tags out of component templates (they become component styles and
 * cannot be data-bound). A classic `@Input` setter (not an `effect()`) keeps it
 * constructible and testable without TestBed.
 */
import { Directive, ElementRef, inject, Input } from '@angular/core';

let scopeCounter = 0;

/** A fresh per-viewer scope token for shared `RIBBON_SCOPE_ATTR`. */
export function nextRibbonScope(): string {
	scopeCounter += 1;
	return `pptx-ng-${scopeCounter}`;
}

@Directive({
	selector: '[pptxRibbonCustomizationStyle]',
	standalone: true,
})
export class RibbonCustomizationStyleDirective {
	private readonly host: HTMLElement = inject(ElementRef<HTMLElement>).nativeElement;
	private styleEl: HTMLStyleElement | null = null;

	/** The stylesheet text; an empty string leaves an empty `<style>` in place. */
	@Input({ required: true })
	get pptxRibbonCustomizationStyle(): string {
		return this.styleEl?.textContent ?? '';
	}
	set pptxRibbonCustomizationStyle(css: string) {
		if (!this.styleEl) {
			this.styleEl = this.host.ownerDocument.createElement('style');
			this.styleEl.setAttribute('data-pptx-ribbon-customization', '');
			this.host.appendChild(this.styleEl);
		}
		if (this.styleEl.textContent !== css) {
			this.styleEl.textContent = css;
		}
	}
}

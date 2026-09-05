/**
 * `pptx-dynamic-style`: a `<style>` element whose text follows a signal.
 *
 * Angular's template compiler strips every literal `<style>` from a component
 * template and folds its STATIC text into the component's styles, so both
 * `<style>{{ css }}</style>` and `<style [textContent]="css">` render nothing
 * at runtime (the former even trips esbuild's CSS parser on the `{{`). The
 * other four bindings interpolate into a real `<style>` (Svelte via
 * `<svelte:element this={'style'}>`, Vue via `<component :is="'style'">`);
 * this component is Angular's equivalent: it creates the element imperatively
 * through `Renderer2`, which the compiler never sees, and keeps its
 * `textContent` in step with the `css` input.
 *
 * Used for per-element animation CSS that must live in the document rather
 * than in component styles: the text-style emphasis override
 * (`animation-text-style-css.ts`) and the ink replay keyframes.
 *
 * @module viewer/dynamic-style.component
 */
import {
	ChangeDetectionStrategy,
	Component,
	effect,
	ElementRef,
	inject,
	input,
	Renderer2,
} from '@angular/core';

@Component({
	selector: 'pptx-dynamic-style',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: '',
	host: { style: 'display: contents' },
})
export class DynamicStyleComponent {
	/** The stylesheet text; `undefined`/empty removes the `<style>` element. */
	readonly css = input<string | undefined>(undefined);

	private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
	private readonly renderer = inject(Renderer2);
	private styleEl: HTMLStyleElement | undefined;

	constructor() {
		effect(() => {
			const text = this.css();
			if (!text) {
				if (this.styleEl) {
					this.renderer.removeChild(this.host.nativeElement, this.styleEl);
					this.styleEl = undefined;
				}
				return;
			}
			if (!this.styleEl) {
				this.styleEl = this.renderer.createElement('style') as HTMLStyleElement;
				this.renderer.appendChild(this.host.nativeElement, this.styleEl);
			}
			this.renderer.setProperty(this.styleEl, 'textContent', text);
		});
	}
}

/**
 * ribbon-gallery-svg.pipe.ts: `| pptxGallerySvg` marks a gallery tile's
 * `previewSvg` as trusted markup for an `[innerHTML]` binding.
 *
 * Angular's default HTML sanitiser strips `<svg>` content, which would leave
 * every tile blank. The preview strings come from `pptx-viewer-shared`'s
 * gallery modules, which build them only from catalogue data and theme
 * colours (never from user text), so bypassing the sanitiser here is the
 * same trust decision React's `dangerouslySetInnerHTML`, Vue's `v-html`,
 * Svelte's `{@html}` and vanilla's `innerHTML` make for the same string.
 */
import { inject, Pipe } from '@angular/core';
import type { PipeTransform } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import type { SafeHtml } from '@angular/platform-browser';

@Pipe({ name: 'pptxGallerySvg', standalone: true })
export class RibbonGallerySvgPipe implements PipeTransform {
	private readonly sanitizer = inject(DomSanitizer);

	transform(svg: string): SafeHtml {
		return this.sanitizer.bypassSecurityTrustHtml(svg);
	}
}

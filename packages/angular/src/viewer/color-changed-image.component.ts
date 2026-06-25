import { NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, input, signal } from '@angular/core';

import {
	applyColorChange,
	buildCacheKey,
	getCachedResult,
	setCachedResult,
} from '../internal/shared';
import type { ClrChangeParams } from './color-changed-image-helpers';

/**
 * ColorChangedImageComponent: Angular port of the React `ColorChangedImage`.
 *
 * Renders an `<img>` with the PowerPoint `<a:clrChange>` colour-replacement
 * (chroma-key) effect applied via an offscreen canvas. The pixel work is the
 * framework-agnostic shared `applyColorChange`, which is asynchronous: the
 * ORIGINAL `src` is shown while processing runs (and on failure / when no
 * canvas is available), then the processed data URL swaps in once ready.
 *
 * Results are memoised through the shared cache so repeated renders of the same
 * image + effect are instant. Processing re-runs whenever `src` or any
 * `clrChange` parameter changes; an in-flight result is discarded if its inputs
 * are superseded before it resolves.
 *
 * SSR / test-safe: `applyColorChange` only touches `Image`/`document`/`canvas`
 * inside the browser code path, so this component renders the original `src`
 * (its fallback) when those are unavailable and never throws.
 */
@Component({
	selector: 'pptx-color-changed-image',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<img
			[src]="displaySrc()"
			[alt]="alt()"
			[class]="imgClass()"
			[ngStyle]="imgStyle()"
			draggable="false"
		/>
	`,
	imports: [NgStyle],
	host: { ngSkipHydration: 'true' },
})
export class ColorChangedImageComponent {
	/** Original image data-URL (or blob URL). */
	readonly src = input.required<string>();
	/** Parsed colour-change parameters (clrFrom / clrTo / transparent / tolerance). */
	readonly clrChange = input.required<ClrChangeParams>();
	/** Alt text for the `<img>`. */
	readonly alt = input<string>('');
	/** CSS class list for the `<img>`. */
	readonly imgClass = input<string>('');
	/** `[ngStyle]` map for the `<img>`. */
	readonly imgStyle = input<Record<string, string | number>>({});

	/** Processed data URL once ready; `null` while falling back to the original. */
	private readonly processed = signal<string | null>(null);

	/** Cache key for the current src + effect combination. */
	private readonly cacheKey = computed(() => {
		const cc = this.clrChange();
		return buildCacheKey(this.src(), cc.clrFrom, cc.clrTo, cc.tolerance, cc.clrToTransparent);
	});

	/** The `<img>` src: processed result when available, else the original. */
	readonly displaySrc = computed(() => this.processed() ?? this.src());

	constructor() {
		effect((onCleanup) => {
			const src = this.src();
			const cc = this.clrChange();
			const key = this.cacheKey();

			const cached = getCachedResult(key);
			if (cached) {
				this.processed.set(cached);
				return;
			}

			// No cache hit yet: show the original until processing resolves.
			this.processed.set(null);

			let cancelled = false;
			onCleanup(() => {
				cancelled = true;
			});

			void applyColorChange(src, cc.clrFrom, cc.clrTo, cc.tolerance, cc.clrToTransparent)
				.then((result) => {
					if (cancelled) {
						return undefined;
					}
					setCachedResult(key, result.dataUrl);
					this.processed.set(result.dataUrl);
					return undefined;
				})
				.catch(() => {
					// Processing failed (no canvas, decode error, ...): stay on the
					// original src, which is already the displayed fallback.
				});
		});
	}
}

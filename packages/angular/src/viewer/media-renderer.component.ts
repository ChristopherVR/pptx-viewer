import { NgStyle } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { PptxElement, PptxMediaType } from 'pptx-viewer-core';

import { getClrChangeParams } from './color-changed-image-helpers';
import type { ClrChangeParams } from './color-changed-image-helpers';
import { ColorChangedImageComponent } from './color-changed-image.component';
import { getContainerStyle, getImageSrc } from './element-style';
import type { StyleMap } from './element-style';
import {
	asMediaElement,
	buildTrimFragment,
	resolveCaptionTracks,
	resolveMediaSrc,
} from './media-renderer-helpers';
import type { ResolvedCaptionTrack } from './media-renderer-helpers';

/**
 * MediaRendererComponent: the `media` branch of {@link ElementRendererComponent},
 * extracted to keep the dispatcher thin. Angular port of the React
 * `renderMediaElement` (packages/react/src/viewer/utils/media-render.tsx) and
 * the Vue `ElementMediaBox.vue`.
 *
 * Plays a native `<video>` / `<audio>` when a source is resolvable (inline
 * `mediaData` URL or a `mediaPath` looked up in the media map), honouring the
 * poster frame, trim points (`#t=start,end` media fragment), loop flag, and
 * closed-caption tracks. When no source is available it falls back to the
 * poster image (with `<a:clrChange>` chroma-key support), then a placeholder.
 *
 * On the interactive (edit) canvas native controls are suppressed and pointer
 * events are disabled so a click selects / moves the element rather than
 * scrubbing playback; preview / presentation canvases play normally. This
 * mirrors Vue's `interactive`-gated controls.
 */
@Component({
	selector: 'pptx-media-renderer',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle, ColorChangedImageComponent],
	template: `
		<div
			class="pptx-ng-element pptx-ng-media"
			[ngStyle]="containerStyle()"
			[attr.data-element-id]="element().id"
			[attr.data-pptx-element]="interactive() ? 'true' : null"
		>
			@if (mediaSrc(); as src) {
				@if (mediaKind() === 'audio') {
					<audio
						class="pptx-ng-media-el pptx-ng-media-audio"
						[class.pptx-ng-media-inert]="interactive()"
						[src]="src + trimFragment()"
						[controls]="!interactive()"
						[loop]="loop()"
						preload="metadata"
					></audio>
				} @else {
					<video
						class="pptx-ng-media-el pptx-ng-media-video"
						[class.pptx-ng-media-inert]="interactive()"
						[src]="src + trimFragment()"
						[poster]="poster() ?? null"
						[controls]="!interactive()"
						[loop]="loop()"
						preload="metadata"
						playsInline
					>
						@for (track of captionTracks(); track track.id) {
							<track
								[attr.kind]="track.kind"
								[attr.label]="track.label"
								[attr.srclang]="track.language"
								[src]="track.src"
								[attr.default]="track.isDefault ? '' : null"
							/>
						}
					</video>
				}
			} @else if (poster(); as posterSrc) {
				@if (clrChangeParams(); as cc) {
					<pptx-color-changed-image
						[src]="posterSrc"
						[clrChange]="cc"
						alt=""
						imgClass="pptx-ng-img"
					/>
				} @else {
					<img [src]="posterSrc" alt="" class="pptx-ng-img" />
				}
			} @else {
				<div class="pptx-ng-placeholder">{{ placeholderLabel() }}</div>
			}
		</div>
	`,
	styles: [
		`
			.pptx-ng-media-el {
				display: block;
				pointer-events: auto;
			}
			.pptx-ng-media-video {
				width: 100%;
				height: 100%;
				object-fit: contain;
			}
			.pptx-ng-media-audio {
				width: 100%;
			}
			/* On the edit canvas, clicks select/move the element instead of the player. */
			.pptx-ng-media-inert {
				pointer-events: none;
			}
			.pptx-ng-img {
				width: 100%;
				height: 100%;
				object-fit: contain;
				display: block;
			}
		`,
	],
})
export class MediaRendererComponent {
	/** The element to render. Playback only occurs when `type === 'media'`. */
	readonly element = input.required<PptxElement>();
	readonly mediaDataUrls = input<Map<string, string>>(new Map());
	readonly zIndex = input<number>(0);
	readonly interactive = input<boolean>(true);
	/** Fallback text shown when neither a source nor a poster is available. */
	readonly placeholderLabel = input<string>('Media');

	readonly containerStyle = computed<StyleMap>(() =>
		getContainerStyle(this.element(), this.zIndex()),
	);

	/** Poster / preview frame data-URL (also used as the `<video poster>`). */
	readonly poster = computed<string | undefined>(() =>
		getImageSrc(this.element(), this.mediaDataUrls()),
	);

	/** Playable source URL (inline data URL or resolved archive path). */
	readonly mediaSrc = computed<string | undefined>(() => {
		const media = asMediaElement(this.element());
		return media ? resolveMediaSrc(media, this.mediaDataUrls()) : undefined;
	});

	readonly mediaKind = computed<PptxMediaType | undefined>(
		() => asMediaElement(this.element())?.mediaType,
	);

	readonly loop = computed<boolean>(() => asMediaElement(this.element())?.loop === true);

	readonly trimFragment = computed<string>(() => {
		const media = asMediaElement(this.element());
		return media ? buildTrimFragment(media) : '';
	});

	readonly captionTracks = computed<ResolvedCaptionTrack[]>(() =>
		resolveCaptionTracks(asMediaElement(this.element())?.captionTracks),
	);

	readonly clrChangeParams = computed<ClrChangeParams | undefined>(() =>
		getClrChangeParams(this.element()),
	);
}

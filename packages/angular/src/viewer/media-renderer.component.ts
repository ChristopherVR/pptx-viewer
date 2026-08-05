import { NgStyle } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	computed,
	effect,
	inject,
	input,
	viewChild,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { PptxElement, PptxMediaType } from 'pptx-viewer-core';

import {
	applyMediaPlaybackAttributes,
	mediaTransportVisible,
	startMediaAutoplay,
} from '../internal/shared';
import { getClrChangeParams } from './color-changed-image-helpers';
import type { ClrChangeParams } from './color-changed-image-helpers';
import { ColorChangedImageComponent } from './color-changed-image.component';
import { getContainerStyle, getImageSrc } from './element-style';
import type { StyleMap } from './element-style';
import {
	asMediaElement,
	buildTrimFragment,
	registerCrossSlideAudio,
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
 * scrubbing playback.
 *
 * They are suppressed during a SHOW too, which the `interactive` gate alone got
 * backwards: a running show is non-interactive, so it turned the transport ON,
 * and a full-bleed background video then painted Chrome's own black scrubber
 * across the bottom of the slide, over the presentation toolbar. PowerPoint
 * shows no transport during a show either; React gates on the same condition
 * (`controls={!isPresentationMode}`).
 *
 * The same `interactive` gate turned it on for every STILL of a slide as well
 * (the presenter console's current-slide pane and next-slide preview, the
 * thumbnail rail), so the console painted a scrubber over a slide the speaker
 * cannot play. {@link showControls} routes the decision through the shared
 * `mediaTransportVisible`, which owns the show/still rules for all five
 * bindings and leaves the authoring canvas to each of them.
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
						#mediaEl
						class="pptx-ng-media-el pptx-ng-media-audio"
						[class.pptx-ng-media-inert]="interactive()"
						[src]="src + trimFragment()"
						[controls]="showControls()"
						[loop]="loop()"
						preload="metadata"
					></audio>
				} @else {
					<video
						#mediaEl
						class="pptx-ng-media-el pptx-ng-media-video"
						[class.pptx-ng-media-inert]="interactive()"
						[src]="src + trimFragment()"
						[poster]="poster() ?? null"
						[controls]="showControls()"
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
	/**
	 * True only on the live presentation stage. When set, the media element
	 * starts playing on its own once mounted (as PowerPoint does when a slide
	 * with media becomes active) instead of waiting for a manual click; the
	 * thumbnail / sorter / editor canvases leave it false so their media is quiet.
	 */
	readonly presenting = input<boolean>(false);
	/** Fallback text shown when neither a source nor a poster is available. */
	readonly placeholderLabel = input<string>(
		inject(TranslateService).instant('pptx.elementType.media'),
	);

	/** The live `<video>`/`<audio>` node (only one is mounted at a time). */
	private readonly mediaElRef = viewChild<ElementRef<HTMLMediaElement>>('mediaEl');

	constructor() {
		// Presentation autoplay: once the media node is in the DOM and this is the
		// live stage, start playback; pause again if it leaves present mode. Reads
		// mediaSrc so a source swap re-evaluates. The shared helper owns the
		// `.play()` + blocked-autoplay handling so all five bindings match.
		//
		// The deck's authored playback settings are applied on the same pass.
		// `volume` and `playbackRate` are IDL properties with no attribute form,
		// so the template cannot bind them the way it binds `loop`, and until this
		// they were simply dropped: `solution-explorer.pptx` slide 2 declares
		// `vol="0"` and Angular played it at full volume.
		effect(() => {
			const el = this.mediaElRef()?.nativeElement;
			const presenting = this.presenting();
			this.mediaSrc();
			if (!el) {
				return;
			}
			const media = asMediaElement(this.element());
			if (media) {
				applyMediaPlaybackAttributes(el, media);
			}
			if (presenting) {
				// "Play across slides" audio: a hidden document-level element (the
				// shared persistent-audio manager) carries the sound so it survives
				// this slide's unmount when the show advances. The slide-local copy
				// must then stay silent, or the track doubles while its slide is up.
				if (media && registerCrossSlideAudio(media, this.mediaSrc())) {
					el.muted = true;
					if (!el.paused) {
						el.pause();
					}
					return;
				}
				startMediaAutoplay(el, { trimStartMs: media?.trimStartMs });
			} else if (!el.paused) {
				el.pause();
			}
		});
	}

	/**
	 * Whether to paint the browser's native transport.
	 *
	 * `canvasTransport: false` is this binding's own long-standing answer for its
	 * authoring canvas: a click there selects or moves the picture, so a scrubber
	 * would only steal the gesture (the element also carries `pptx-ng-media-inert`
	 * for the same reason). React paints one on its canvas; that difference is
	 * deliberate and is the only thing the shared rule leaves to the binding.
	 */
	readonly showControls = computed<boolean>(() =>
		mediaTransportVisible({
			presenting: this.presenting(),
			preview: !this.interactive() && !this.presenting(),
			canvasTransport: false,
		}),
	);

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

/**
 * Presentation-mode media autoplay.
 *
 * When present mode makes a slide the active, visible surface, any media on it
 * should begin playing without a manual click (matching PowerPoint's slideshow
 * behaviour). Browsers only honour a fresh `.play()` call, not an `autoplay`
 * attribute added retroactively to an already-mounted node, so each binding
 * calls this once the media element is mounted and its slide is live.
 *
 * `play()` can reject when the browser blocks autoplay-with-sound without a
 * prior user gesture; the rejection is swallowed so it never surfaces as an
 * unhandled promise (the element simply stays paused until the user interacts).
 */
export function startMediaAutoplay(el: HTMLMediaElement, options?: { trimStartMs?: number }): void {
	const trimStartMs = options?.trimStartMs;
	if (trimStartMs !== undefined && trimStartMs > 0) {
		try {
			el.currentTime = trimStartMs / 1000;
		} catch {
			/* seeking before metadata is loaded can throw in some browsers; ignore */
		}
	}
	const result = el.play() as Promise<void> | undefined;
	if (result && typeof result.catch === 'function') {
		void result.catch(() => {
			/* autoplay blocked (e.g. sound without a user gesture) */
		});
	}
}

/** The `p:cMediaNode` playback settings a deck asks a media node to honour. */
export interface MediaPlaybackSource {
	/** `<a:videoFile>` / `p:cMediaNode` loop flag. */
	loop?: boolean;
	/** Authored volume, already normalised to 0..1 by the parse layer. */
	volume?: number;
	/** Authored playback rate multiplier. */
	playbackSpeed?: number;
}

/** The DOM-facing playback attributes derived from {@link MediaPlaybackSource}. */
export interface MediaPlaybackAttributes {
	loop: boolean;
	volume: number;
	playbackRate: number;
}

/**
 * Resolve a media element's authored playback settings into DOM attributes.
 *
 * WHY this is shared: the settings live on the parsed element, the mapping is
 * two clamps and a default, and getting it wrong is invisible in a screenshot.
 * Vanilla and Svelte both omitted `loop`, so `solution-explorer.pptx` slide 2 -
 * a 2-second clip the deck marks `loop` and drives with a `playFrom(0.0)` on
 * slide entry - played once, hit its end and froze on the last frame, which
 * reads exactly like "the video never started". Volume was worse: only React
 * applied it, so a deck that says `vol="0"` blared out of the other four.
 */
export function mediaPlaybackAttributes(source: MediaPlaybackSource): MediaPlaybackAttributes {
	return {
		loop: source.loop === true,
		volume: Math.max(0, Math.min(1, source.volume ?? 1)),
		playbackRate: Math.max(0.25, Math.min(4, source.playbackSpeed ?? 1)),
	};
}

/**
 * Apply {@link mediaPlaybackAttributes} to a live node.
 *
 * `volume` and `playbackRate` are IDL properties with no attribute form, so the
 * declarative bindings cannot set them from a template the way they set `loop`;
 * every binding therefore needs this imperative step, not just the DOM ones.
 */
export function applyMediaPlaybackAttributes(
	el: HTMLMediaElement,
	source: MediaPlaybackSource,
): void {
	const attributes = mediaPlaybackAttributes(source);
	el.loop = attributes.loop;
	el.volume = attributes.volume;
	el.playbackRate = attributes.playbackRate;
}

/** Which surface a slide is being painted on, as far as a media element cares. */
export interface MediaSurface {
	/** True only on the live slide-show stage. */
	presenting: boolean;
	/**
	 * True when the slide is painted as a STILL of itself: the presenter
	 * console's current-slide pane and next-slide preview, the slide-thumbnail
	 * rail, a slide-transition overlay, an export raster. Never the surface the
	 * show is actually running on.
	 */
	preview: boolean;
}

/**
 * Derive a {@link MediaSurface} from the two flags a binding's renderer carries.
 *
 * "Neither interactive nor presenting" is what a STILL of a slide looks like
 * from inside an element renderer, and all four declarative bindings had spelt
 * that out by hand - twice each, once per shared media rule. Deriving it once
 * keeps a binding from quietly answering the two rules differently.
 */
export function mediaSurfaceOf(input: { interactive: boolean; presenting: boolean }): MediaSurface {
	return {
		presenting: input.presenting,
		preview: !input.interactive && !input.presenting,
	};
}

/** {@link MediaSurface} plus the one answer each binding owns for itself. */
export interface MediaTransportSurface extends MediaSurface {
	/**
	 * What the binding would do on its own AUTHORING canvas, which the five
	 * deliberately differ on: React paints a transport there, Angular suppresses
	 * it so a click selects the shape instead, Vue paints one but makes it inert.
	 * That difference is not this function's business; it only overrides the
	 * answer on the two surfaces where PowerPoint never paints a transport.
	 */
	canvasTransport: boolean;
}

/**
 * Whether a media element should carry the browser's native transport.
 *
 * PowerPoint paints no control bar during a show, and none on a still of a
 * slide either. Four bindings got the still wrong: the presenter console's
 * panes render through a NON-presenting stage, so `controls = !presenting` (and
 * Angular's `controls = !interactive && !presenting`) turned Chrome's black
 * scrubber ON inside the console, across the bottom of a slide the presenter
 * cannot even play. React escaped only by accident - its preview renderer
 * passes no media map, so the video falls back to a poster image and there is
 * no `<video>` to put a transport on.
 */
export function mediaTransportVisible(surface: MediaTransportSurface): boolean {
	if (surface.presenting || surface.preview) {
		return false;
	}
	return surface.canvasTransport;
}

/** What a media element has to fall back on when it cannot mount a player. */
export interface MediaFallbackInput {
	/** The element resolved a poster / preview frame to paint. */
	hasPoster: boolean;
	/** The deck references media the package could not resolve (`mediaMissing`). */
	missing?: boolean;
}

/**
 * What the deck said a media element is. Mirrors core's `PptxMediaType`
 * (including its `unknown`) without importing it, so this module stays free of
 * a core dependency; `unknown` gets the generic icon and label.
 */
export type MediaKind = 'video' | 'audio' | 'unknown';

/** The centred affordance drawn over a poster frame. */
export type MediaFallbackBadge = 'none' | 'play' | 'missing';

/** The box drawn when there is not even a poster frame to paint. */
export type MediaFallbackPlaceholder = 'none' | 'typed' | 'missing';

/** The layers a media element paints when no playable source is available. */
export interface MediaFallbackVisual {
	/** Paint the poster frame. Only ever true when the element has one. */
	poster: boolean;
	/** Dim the poster, signalling that the media behind it is unavailable. */
	dimPoster: boolean;
	/** Which affordance to centre over the poster, if any. */
	badge: MediaFallbackBadge;
	/** Which box to paint instead of a poster, if any. */
	placeholder: MediaFallbackPlaceholder;
}

/**
 * What a media element paints when it has no playable source.
 *
 * WHY this is shared (issue #147): a slide-transition overlay is a STILL of the
 * outgoing slide, and React's overlay renders it without the media map, so a
 * full-bleed background video fell back to its poster frame AND to the centred
 * play badge that goes with it. The badge is authoring chrome, not slide
 * content, so `solution-explorer.pptx` played a mystery play triangle across
 * the middle of every morph out of slide 2 - which is exactly what the reporter
 * caught at 11s. The same class of artefact was one map away in the other four:
 * their typed "Media" placeholder box is chrome too, and it paints on any still
 * whose media cannot resolve.
 *
 * The rule: a still of a slide - and the show itself - paints slide CONTENT and
 * nothing else. Only the authoring canvas adds the affordance that says "this
 * picture is a video you cannot play here".
 *
 * `badge` and `placeholder` are unions rather than booleans on purpose. As
 * booleans, four bindings read "paint a badge" and drew a PLAY triangle over
 * media the package had failed to find - the opposite of what React said in the
 * same spot. A union cannot be half-read.
 */
export function mediaFallbackVisual(
	surface: MediaSurface,
	input: MediaFallbackInput,
): MediaFallbackVisual {
	const contentOnly = surface.presenting || surface.preview;
	if (contentOnly) {
		return { poster: input.hasPoster, dimPoster: false, badge: 'none', placeholder: 'none' };
	}
	const missing = input.missing === true;
	// The badge is an overlay ON a poster; with no poster the placeholder box
	// carries the same icon itself, so exactly one of the two is ever set.
	if (input.hasPoster) {
		return {
			poster: true,
			dimPoster: missing,
			badge: missing ? 'missing' : 'play',
			placeholder: 'none',
		};
	}
	return {
		poster: false,
		dimPoster: false,
		badge: 'none',
		placeholder: missing ? 'missing' : 'typed',
	};
}

/**
 * The icons the fallback draws, as SVG path `d` strings in a 24x24 `viewBox`,
 * stroked with `currentColor` over `fill: none`.
 *
 * Paths rather than each binding's own `<circle>` / `<polygon>` / `<line>` mix:
 * one array renders identically through JSX, a Vue/Svelte `for`, an Angular
 * `@for` and a DOM loop, so the five icons cannot drift apart.
 */
export const MEDIA_FALLBACK_ICONS: Readonly<
	Record<'play' | 'missing' | 'audio', readonly string[]>
> = {
	play: ['M5 3 L19 12 L5 21 Z'],
	missing: ['M12 2 a10 10 0 1 0 0 20 a10 10 0 1 0 0-20', 'M4 4 L20 20'],
	audio: [
		'M9 18V5l12-2v13',
		'M6 15 a3 3 0 1 0 0 6 a3 3 0 1 0 0-6',
		'M18 13 a3 3 0 1 0 0 6 a3 3 0 1 0 0-6',
	],
};

/**
 * The icon for a resolved {@link MediaFallbackVisual}, or `[]` when the surface
 * asks for none. An untyped placeholder gets no icon, as React has always done:
 * the deck never said whether it is a clip or a track.
 */
export function mediaFallbackIcon(
	visual: MediaFallbackVisual,
	mediaType?: MediaKind,
): readonly string[] {
	if (visual.badge === 'missing' || visual.placeholder === 'missing') {
		return MEDIA_FALLBACK_ICONS.missing;
	}
	if (visual.badge === 'play') {
		return MEDIA_FALLBACK_ICONS.play;
	}
	if (visual.placeholder === 'typed') {
		if (mediaType === 'audio') {
			return MEDIA_FALLBACK_ICONS.audio;
		}
		if (mediaType === 'video') {
			return MEDIA_FALLBACK_ICONS.play;
		}
	}
	return [];
}

/**
 * The i18n key labelling a resolved {@link MediaFallbackVisual}, or `undefined`
 * when it carries no label (the play badge is a bare triangle).
 *
 * Shared because the five disagreed: React hard-coded the English words "Video"
 * and "Audio" - untranslated, in a package that ships four locales - while the
 * other four labelled every unplayable element the same flat "Media", whatever
 * the deck said it was.
 */
export function mediaFallbackLabelKey(
	visual: MediaFallbackVisual,
	mediaType?: MediaKind,
): string | undefined {
	if (visual.badge === 'missing' || visual.placeholder === 'missing') {
		return 'pptx.media.notFound';
	}
	if (visual.placeholder !== 'typed') {
		return undefined;
	}
	if (mediaType === 'video') {
		return 'pptx.media.videoClip';
	}
	if (mediaType === 'audio') {
		return 'pptx.media.audioClip';
	}
	return 'pptx.elementType.media';
}

export const MEDIA_CHROME_ATTRIBUTE = 'data-pptx-media-chrome';

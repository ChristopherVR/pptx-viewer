/**
 * Fluent builder for {@link MediaPptxElement} instances.
 *
 * Provides a step-by-step, method-chaining API for constructing media
 * (video or audio) elements. The {@link MediaBuilder.build | .build()} method
 * delegates to {@link createMediaElement}, so the output is identical to the
 * functional API.
 *
 * @example
 * ```ts
 * const el = MediaBuilder.video("data:video/mp4;base64,...")
 *   .position(100, 100).size(640, 360)
 *   .autoPlay().loop()
 *   .build();
 * ```
 *
 * @module sdk/MediaBuilder
 */

import type { MediaPptxElement } from '../../types/elements';
import { createMediaElement } from './ElementFactory';
import type { MediaOptions } from './types';

/**
 * Fluent builder for {@link MediaPptxElement} instances.
 *
 * @example
 * ```ts
 * const el = MediaBuilder.video("data:video/mp4;base64,...")
 *   .position(100, 100).size(640, 360)
 *   .autoPlay().loop()
 *   .build();
 * ```
 */
export class MediaBuilder {
	private _mediaType: 'video' | 'audio';
	private _source: string;
	private _options: MediaOptions = {};

	private constructor(mediaType: 'video' | 'audio', source: string) {
		this._mediaType = mediaType;
		this._source = source;
	}

	/**
	 * Create a MediaBuilder for a video element.
	 *
	 * @param source - Data URL or archive path for the video file.
	 * @returns A new {@link MediaBuilder} instance configured for video.
	 *
	 * @example
	 * ```ts
	 * const video = MediaBuilder.video("data:video/mp4;base64,...").build();
	 * ```
	 */
	static video(source: string): MediaBuilder {
		return new MediaBuilder('video', source);
	}

	/**
	 * Create a MediaBuilder for an audio element.
	 *
	 * @param source - Data URL or archive path for the audio file.
	 * @returns A new {@link MediaBuilder} instance configured for audio.
	 *
	 * @example
	 * ```ts
	 * const audio = MediaBuilder.audio("data:audio/mp3;base64,...").build();
	 * ```
	 */
	static audio(source: string): MediaBuilder {
		return new MediaBuilder('audio', source);
	}

	/**
	 * Create a MediaBuilder for the given media type and source.
	 *
	 * @param mediaType - Either `"video"` or `"audio"`.
	 * @param source - Data URL or archive path for the media file.
	 * @returns A new {@link MediaBuilder} instance.
	 *
	 * @example
	 * ```ts
	 * const media = MediaBuilder.create("video", "ppt/media/video1.mp4").build();
	 * ```
	 */
	static create(mediaType: 'video' | 'audio', source: string): MediaBuilder {
		return new MediaBuilder(mediaType, source);
	}

	// -- Position & size ----------------------------------------------------

	/**
	 * Set the element position (top-left corner) in pixels.
	 *
	 * @param x - Horizontal offset from the left edge of the slide.
	 * @param y - Vertical offset from the top edge of the slide.
	 * @returns The builder instance for chaining.
	 *
	 * @example
	 * ```ts
	 * MediaBuilder.video("...").position(50, 100).build();
	 * ```
	 */
	position(x: number, y: number): this {
		this._options.x = x;
		this._options.y = y;
		return this;
	}

	/**
	 * Set the element dimensions in pixels.
	 *
	 * @param width - Element width.
	 * @param height - Element height.
	 * @returns The builder instance for chaining.
	 *
	 * @example
	 * ```ts
	 * MediaBuilder.video("...").size(640, 360).build();
	 * ```
	 */
	size(width: number, height: number): this {
		this._options.width = width;
		this._options.height = height;
		return this;
	}

	/**
	 * Set position and size in a single call.
	 *
	 * @param x - Horizontal offset.
	 * @param y - Vertical offset.
	 * @param width - Element width.
	 * @param height - Element height.
	 * @returns The builder instance for chaining.
	 *
	 * @example
	 * ```ts
	 * MediaBuilder.video("...").bounds(50, 100, 640, 360).build();
	 * ```
	 */
	bounds(x: number, y: number, width: number, height: number): this {
		this._options.x = x;
		this._options.y = y;
		this._options.width = width;
		this._options.height = height;
		return this;
	}

	/**
	 * Set the rotation angle in degrees.
	 *
	 * @param degrees - Clockwise rotation in degrees.
	 * @returns The builder instance for chaining.
	 *
	 * @example
	 * ```ts
	 * MediaBuilder.video("...").rotation(90).build();
	 * ```
	 */
	rotation(degrees: number): this {
		this._options.rotation = degrees;
		return this;
	}

	// -- Media-specific -----------------------------------------------------

	/**
	 * Enable or disable auto-play on slide entry.
	 *
	 * @param enabled - Pass `false` to disable; defaults to `true`.
	 * @returns The builder instance for chaining.
	 *
	 * @example
	 * ```ts
	 * MediaBuilder.video("...").autoPlay().build();
	 * ```
	 */
	autoPlay(enabled?: boolean): this {
		this._options.autoPlay = enabled ?? true;
		return this;
	}

	/**
	 * Enable or disable looping playback.
	 *
	 * @param enabled - Pass `false` to disable; defaults to `true`.
	 * @returns The builder instance for chaining.
	 *
	 * @example
	 * ```ts
	 * MediaBuilder.audio("...").loop().build();
	 * ```
	 */
	loop(enabled?: boolean): this {
		this._options.loop = enabled ?? true;
		return this;
	}

	/**
	 * Set the playback volume.
	 *
	 * @param value - Volume level (typically 0 to 1, or a percentage value).
	 * @returns The builder instance for chaining.
	 *
	 * @example
	 * ```ts
	 * MediaBuilder.audio("...").volume(0.5).build();
	 * ```
	 */
	volume(value: number): this {
		this._options.volume = value;
		return this;
	}

	/**
	 * Set the trim start and end times in milliseconds.
	 *
	 * Trims the media to play only the segment between `startMs` and `endMs`.
	 *
	 * @param startMs - Start time in milliseconds.
	 * @param endMs - End time in milliseconds.
	 * @returns The builder instance for chaining.
	 *
	 * @example
	 * ```ts
	 * MediaBuilder.video("...").trim(1000, 5000).build();
	 * ```
	 */
	trim(startMs: number, endMs: number): this {
		this._options.trimStartMs = startMs;
		this._options.trimEndMs = endMs;
		return this;
	}

	/**
	 * Set a poster frame (thumbnail) for the media element.
	 *
	 * @param dataUrl - A data URL for the poster frame image.
	 * @returns The builder instance for chaining.
	 *
	 * @example
	 * ```ts
	 * MediaBuilder.video("...")
	 *   .posterFrame("data:image/png;base64,...")
	 *   .build();
	 * ```
	 */
	posterFrame(dataUrl: string): this {
		this._options.posterFrame = dataUrl;
		return this;
	}

	// -- Build --------------------------------------------------------------

	/**
	 * Build the final {@link MediaPptxElement}.
	 *
	 * Delegates to {@link createMediaElement} with the accumulated options.
	 *
	 * @returns A fully constructed media element ready for insertion into a slide.
	 *
	 * @example
	 * ```ts
	 * const el = MediaBuilder.video("data:video/mp4;base64,...")
	 *   .position(100, 100).size(640, 360)
	 *   .autoPlay()
	 *   .build();
	 * ```
	 */
	build(): MediaPptxElement {
		return createMediaElement(this._mediaType, this._source, this._options);
	}
}

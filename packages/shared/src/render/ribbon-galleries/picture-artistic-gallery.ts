/**
 * Picture Format > Adjust > Artistic Effects. Offers exactly the effects the
 * renderer draws AND core serialises as `a14:artistic*` elements (the
 * inspector's catalogue minus the recolor/correction entries `grayscale`,
 * `sepia` and `sharpen`, which OOXML does not store as artistic effects and
 * which live in the Color and Corrections galleries). A pick writes
 * `imageEffects.artisticEffect`, the same field the inspector gallery writes.
 *
 * @module render/ribbon-galleries/picture-artistic-gallery
 */
import { ARTISTIC_EFFECTS } from '../image-artistic-presets';
import { adjustGalleryModule } from './picture-adjust-gallery';
import type { AdjustPreset, AdjustSection } from './picture-adjust-gallery';

const KEY = 'pptx.gallery.pictureArtisticEffects';

/** Catalogue entries that are Color / Corrections settings in OOXML, not artistic effects. */
const NOT_ARTISTIC: ReadonlySet<string> = new Set(['grayscale', 'sepia', 'sharpen']);

/**
 * Gallery names whose a14 element name is not `artistic` + the capitalised
 * name (core's `GALLERY_TO_A14`). A saved pick reloads under the a14 name.
 */
const IRREGULAR_A14: Readonly<Record<string, string>> = {
	mosaic: 'artisticMosiaicBubbles',
	glow_edges: 'artisticGlowEdges',
	paint: 'artisticPaintBrush',
};

/** True when a stored `artisticEffect` is gallery effect `name` (either spelling). */
export function isSameArtisticEffect(stored: string | undefined, name: string): boolean {
	if (!stored) {
		return false;
	}
	const a14 = IRREGULAR_A14[name] ?? `artistic${name.charAt(0).toUpperCase()}${name.slice(1)}`;
	return stored === name || stored === a14;
}

function artisticPreset(name: string, labelKey: string, css: string): AdjustPreset {
	const none = name === 'none';
	return {
		id: none ? 'artisticNone' : name,
		labelKey,
		label: name,
		changes: (fx) =>
			none
				? { artisticEffect: undefined, artisticParams: undefined, artisticRadius: undefined }
				: isSameArtisticEffect(fx.artisticEffect, name)
					? {}
					: { artisticEffect: name, artisticParams: undefined, artisticRadius: undefined },
		applied: (fx) => (none ? !fx.artisticEffect : isSameArtisticEffect(fx.artisticEffect, name)),
		preview: { css },
	};
}

/** The effect names this gallery offers, in tile order (`none` first). */
export const PICTURE_ARTISTIC_EFFECT_NAMES: readonly string[] = ARTISTIC_EFFECTS.map(
	([name]) => name as string,
).filter((name) => !NOT_ARTISTIC.has(name));

export function pictureArtisticSections(): AdjustSection[] {
	return [
		{
			id: 'effects',
			columns: 4,
			presets: ARTISTIC_EFFECTS.filter(([name]) => !NOT_ARTISTIC.has(name)).map(
				([name, labelKey, css]) => artisticPreset(name, labelKey, css),
			),
		},
	];
}

export const PICTURE_ARTISTIC_EFFECTS_GALLERY = adjustGalleryModule(
	'pictureArtisticEffects',
	`${KEY}.title`,
	'Artistic Effects',
	pictureArtisticSections,
);

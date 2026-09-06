import { effectSoundCatalogueEntry } from './effect-sound-catalogue';
/**
 * Synthesised, DOM-free asset for each entry of PowerPoint's stock sound
 * gallery (`effect-sound-catalogue.ts`), built at call time from
 * `effect-sound-generators.ts` and cached by id.
 *
 * @module render/effect-sound-synth
 */
import { normalize } from './effect-sound-dsp';
import { EFFECT_SOUND_GENERATORS } from './effect-sound-generators';
import { encodeWav, wavDataUrl } from './effect-sound-wav-encoder';

/** A synthesised stock sound, ready to embed or play. */
export interface EffectSoundAsset {
	/** Catalogue id, e.g. `"chime"`. */
	id: string;
	/** The canonical PowerPoint file name (also the OOXML `@_name` to write). */
	fileName: string;
	/** Raw 16-bit mono WAV bytes. */
	bytes: Uint8Array;
	/** `data:audio/wav;base64,...` form of {@link bytes}, ready for playback or staging as a pending embed. */
	dataUrl: string;
}

const assetCache = new Map<string, EffectSoundAsset>();

/**
 * Synthesise (or return the cached synthesis of) the stock sound named by
 * `id`. Returns `undefined` for an id absent from the catalogue.
 */
export function getEffectSoundAsset(id: string): EffectSoundAsset | undefined {
	const cached = assetCache.get(id);
	if (cached) {
		return cached;
	}
	const entry = effectSoundCatalogueEntry(id);
	const generator = EFFECT_SOUND_GENERATORS[id];
	if (!entry || !generator) {
		return undefined;
	}
	const bytes = encodeWav(normalize(generator()));
	const asset: EffectSoundAsset = {
		id,
		fileName: entry.canonicalName,
		bytes,
		dataUrl: wavDataUrl(bytes),
	};
	assetCache.set(id, asset);
	return asset;
}

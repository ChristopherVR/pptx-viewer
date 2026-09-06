/**
 * slide-transition-sound: the decision logic behind the ribbon's Transitions >
 * Sound picker.
 *
 * WHY shared: every binding's Sound `<select>` used to render permanently
 * `disabled` with a single "[No Sound]" entry and a comment explaining there
 * was nothing behind it to author. Picking a NEW sound is a two-part problem -
 * what the picker should show (its options and the currently-selected value)
 * and what a pick writes onto the transition - and both parts are pure: no
 * framework is needed to decide either. Only reading the chosen `File`'s bytes
 * (a `FileReader`/`<input type="file">` concern) stays in each binding.
 *
 * A newly-picked file has no relationship id yet (it is not embedded in the
 * package), so it is carried on `PptxSlideTransition.soundData` as a `data:`
 * URL, mirroring how `imageData`/`mediaData` carry an unembedded picture or
 * media file until the save pipeline writes it into the package and mints a
 * relationship (`packages/core`'s `embedTransitionSound`, invoked from the
 * slide save writer). Once that happens `soundRId`/`soundPath` are populated
 * and `soundData` is cleared, exactly like `imagePath` for a picture.
 *
 * WHY the stock gallery needed no core changes: `PptxSlideTransition.soundName`
 * and its write side (`slide-transition-xml.ts`'s `buildTransitionSound`)
 * already round-trip an OOXML `@_name`, which is exactly what COM-verified
 * ground truth (PowerPoint 2016, `SlideShowTransition.SoundEffect.
 * ImportFromFile`, 2026-09-06) showed PowerPoint itself writes for a stock
 * sound: `<p:snd r:embed="rIdN" name="APPLAUSE.WAV"/>`, no separate
 * "built-in" flag anywhere. {@link applyTransitionStockSound} only needed to
 * add an AUTHORING path that stages one of `effect-sound-catalogue.ts`'s 19
 * synthesised sounds with its canonical name.
 *
 * @module render/slide-transition-sound
 */
import type { PptxSlideTransition } from 'pptx-viewer-core';

import { EFFECT_SOUND_CATALOGUE, findEffectSoundCatalogueEntry } from './effect-sound-catalogue';
import { getEffectSoundAsset } from './effect-sound-synth';

/** A local sound file the user picked, already read into memory. */
export interface TransitionSoundFilePick {
	/** The file's original name, e.g. "chime.wav". Shown in the picker and
	 * stored as `soundFileName` for display until the deck is reloaded. */
	name: string;
	/** The file's bytes as a `data:` URL, ready for the save pipeline to embed. */
	dataUrl: string;
}

/** Value the picker's "no transition sound" entry commits. */
export const TRANSITION_SOUND_NONE_VALUE = 'none';
/** Value the picker's "browse for a sound file" entry commits. */
export const TRANSITION_SOUND_OTHER_VALUE = 'other';
/** Value shown for the sound the slide currently carries, once one is set. */
export const TRANSITION_SOUND_CURRENT_VALUE = 'current';

/** One entry of the Sound `<select>`. */
export interface TransitionSoundOption {
	value: string;
	/** i18n key for a built-in label (None / Other Sound...). Absent for the
	 * currently-picked file, whose name is shown untranslated. */
	i18nKey?: string;
	/** Literal label text, used instead of `i18nKey` for the picked file's name. */
	label?: string;
}

/**
 * Options for the Sound `<select>`, in the order PowerPoint's own Sound
 * dropdown uses: the file already picked (if any, and not a stock match),
 * then None, then PowerPoint's 19 built-in stock sounds, then the browse
 * entry.
 */
export function transitionSoundOptions(
	transition: PptxSlideTransition | undefined,
): TransitionSoundOption[] {
	const options: TransitionSoundOption[] = [];
	const stockId = transitionStockSoundId(transition);
	const fileName = transition?.soundFileName?.trim();
	if (fileName && !stockId) {
		options.push({ value: TRANSITION_SOUND_CURRENT_VALUE, label: fileName });
	}
	options.push({ value: TRANSITION_SOUND_NONE_VALUE, i18nKey: 'pptx.ribbon.soundNone' });
	for (const entry of EFFECT_SOUND_CATALOGUE) {
		options.push({ value: entry.id, i18nKey: entry.i18nKey });
	}
	options.push({ value: TRANSITION_SOUND_OTHER_VALUE, i18nKey: 'pptx.ribbon.soundOther' });
	return options;
}

/** The value the Sound `<select>` should currently show as selected. */
export function transitionSoundSelectedValue(transition: PptxSlideTransition | undefined): string {
	const stockId = transitionStockSoundId(transition);
	if (stockId) {
		return stockId;
	}
	return transition?.soundFileName?.trim()
		? TRANSITION_SOUND_CURRENT_VALUE
		: TRANSITION_SOUND_NONE_VALUE;
}

/** Strip a trailing `.ext` from a file name for use as the display sound name. */
function displayNameFromFileName(fileName: string): string {
	const withoutExtension = fileName.replace(/\.[^./\\]+$/u, '');
	return withoutExtension.length > 0 ? withoutExtension : fileName;
}

/**
 * The transition fields a newly-picked local sound file writes.
 *
 * Clears `soundRId`/`soundPath` (any previous embedded sound's identity) and
 * `stopSound` (a fresh sound cannot also be "stop the current sound"), so the
 * save pipeline's `buildTransitionSound` treats `soundData` as authoritative
 * until it is embedded.
 */
export function applyTransitionSoundFile(
	file: TransitionSoundFilePick,
): Partial<PptxSlideTransition> {
	return {
		soundData: file.dataUrl,
		soundFileName: file.name,
		soundName: displayNameFromFileName(file.name),
		soundRId: undefined,
		soundPath: undefined,
		stopSound: undefined,
	};
}

/**
 * The transition fields a stock gallery pick (`catalogueId`, e.g. `"chime"`)
 * writes: the synthesised sound staged pending, with the catalogue's
 * canonical `@_name` so PowerPoint recognises it as that built-in sound on
 * reload (see the module doc comment). Returns `undefined` for an id absent
 * from the catalogue.
 */
export function applyTransitionStockSound(
	catalogueId: string,
): Partial<PptxSlideTransition> | undefined {
	const asset = getEffectSoundAsset(catalogueId);
	if (!asset) {
		return undefined;
	}
	return {
		soundData: asset.dataUrl,
		soundFileName: asset.fileName,
		soundName: asset.fileName,
		soundRId: undefined,
		soundPath: undefined,
		stopSound: undefined,
	};
}

/**
 * The stock-gallery id matching `transition`'s current sound, when its
 * `soundName` names one of PowerPoint's 19 built-in sounds. `undefined` for a
 * custom sound file or no sound at all.
 */
export function transitionStockSoundId(
	transition: PptxSlideTransition | undefined,
): string | undefined {
	return findEffectSoundCatalogueEntry(transition?.soundName)?.id;
}

/** The transition fields the picker's "None" entry writes: no sound at all. */
export function clearTransitionSound(): Partial<PptxSlideTransition> {
	return {
		soundData: undefined,
		soundRId: undefined,
		soundPath: undefined,
		soundFileName: undefined,
		soundName: undefined,
		soundLoop: undefined,
		stopSound: undefined,
		rawSoundAction: undefined,
	};
}

/**
 * Read a locally-picked sound file into a `data:` URL, ready for
 * {@link applyTransitionSoundFile}.
 *
 * `FileReader` is a DOM API every binding already has, but all five Sound
 * pickers were hand-rolling the identical `onload`/`onerror` plumbing around
 * it; wrapping it once here is what {@link applyTransitionSoundFile} already
 * does for the field mapping. Resolves `null` (never rejects) on a read
 * failure, so a caller can skip the commit instead of needing a try/catch.
 */
export function readSoundFileAsDataUrl(file: File): Promise<string | null> {
	return new Promise((resolve) => {
		const reader = new FileReader();
		reader.onload = () => {
			const result = reader.result;
			resolve(typeof result === 'string' ? result : null);
		};
		reader.onerror = () => resolve(null);
		reader.readAsDataURL(file);
	});
}

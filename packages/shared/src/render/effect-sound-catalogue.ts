/**
 * `effect-sound-catalogue`: PowerPoint's built-in stock sound gallery (the 19
 * entries under Animation "Effect Options... > Sound" and under
 * "Transitions > Sound"), as pure framework-neutral data.
 *
 * Microsoft's own WAV assets (`C:\Program Files\Microsoft Office\root\
 * Office16\Media\*.WAV`) cannot be redistributed, so `effect-sound-synth.ts`
 * synthesises a distinct, recognisable placeholder for each entry instead.
 * What DOES matter for interop is {@link EffectSoundCatalogueEntry.canonicalName}:
 * COM-verified against real PowerPoint 2016 (2026-09-06,
 * `Effect.EffectInformation.SoundEffect.ImportFromFile` and
 * `Slide.SlideShowTransition.SoundEffect.ImportFromFile`), importing one of
 * PowerPoint's own stock WAVs writes ONLY a relationship plus this exact
 * upper-case file name into the `@_name` attribute (`p:snd`/`p:sndTgt`).
 * There is no separate "this is a built-in sound" flag anywhere in the
 * schema, nor anything PowerPoint itself writes: reopening the ground-truth
 * file and reading `EffectInformation.SoundEffect.Name`/`.Type` back
 * confirmed name-matching alone is what PowerPoint's own object model uses.
 * Writing the same canonical name against our own synthesised bytes is
 * therefore both necessary and sufficient for PowerPoint to recognise a deck
 * we saved as carrying that stock sound.
 *
 * The 19 names were read directly off a real Office install's MEDIA folder
 * (`APPLAUSE.WAV` .. `WIND.WAV`) and match PowerPoint's own gallery order
 * (alphabetical by display name).
 *
 * @module render/effect-sound-catalogue
 */

/** One entry of PowerPoint's built-in stock sound gallery. */
export interface EffectSoundCatalogueEntry {
	/** Stable id used by the picker UI and `effect-sound-synth.ts`'s generator map. */
	id: string;
	/** i18n key for the display label, e.g. `pptx.animation.sound.chime`. */
	i18nKey: string;
	/** The exact `@_name` PowerPoint writes for this stock sound (COM-verified). */
	canonicalName: string;
}

/** PowerPoint's own stock sound gallery, in its own (alphabetical) order. */
export const EFFECT_SOUND_CATALOGUE: readonly EffectSoundCatalogueEntry[] = [
	{ id: 'applause', i18nKey: 'pptx.animation.sound.applause', canonicalName: 'APPLAUSE.WAV' },
	{ id: 'arrow', i18nKey: 'pptx.animation.sound.arrow', canonicalName: 'ARROW.WAV' },
	{ id: 'bomb', i18nKey: 'pptx.animation.sound.bomb', canonicalName: 'BOMB.WAV' },
	{ id: 'breeze', i18nKey: 'pptx.animation.sound.breeze', canonicalName: 'BREEZE.WAV' },
	{ id: 'camera', i18nKey: 'pptx.animation.sound.camera', canonicalName: 'CAMERA.WAV' },
	{
		id: 'cashRegister',
		i18nKey: 'pptx.animation.sound.cashRegister',
		canonicalName: 'CASHREG.WAV',
	},
	{ id: 'chime', i18nKey: 'pptx.animation.sound.chime', canonicalName: 'CHIMES.WAV' },
	{ id: 'click', i18nKey: 'pptx.animation.sound.click', canonicalName: 'CLICK.WAV' },
	{ id: 'coin', i18nKey: 'pptx.animation.sound.coin', canonicalName: 'COIN.WAV' },
	{ id: 'drumRoll', i18nKey: 'pptx.animation.sound.drumRoll', canonicalName: 'DRUMROLL.WAV' },
	{ id: 'explosion', i18nKey: 'pptx.animation.sound.explosion', canonicalName: 'EXPLODE.WAV' },
	{ id: 'hammer', i18nKey: 'pptx.animation.sound.hammer', canonicalName: 'HAMMER.WAV' },
	{ id: 'laser', i18nKey: 'pptx.animation.sound.laser', canonicalName: 'LASER.WAV' },
	{ id: 'push', i18nKey: 'pptx.animation.sound.push', canonicalName: 'PUSH.WAV' },
	{ id: 'suction', i18nKey: 'pptx.animation.sound.suction', canonicalName: 'SUCTION.WAV' },
	{ id: 'typewriter', i18nKey: 'pptx.animation.sound.typewriter', canonicalName: 'TYPE.WAV' },
	{ id: 'voltage', i18nKey: 'pptx.animation.sound.voltage', canonicalName: 'VOLTAGE.WAV' },
	{ id: 'whoosh', i18nKey: 'pptx.animation.sound.whoosh', canonicalName: 'WHOOSH.WAV' },
	{ id: 'wind', i18nKey: 'pptx.animation.sound.wind', canonicalName: 'WIND.WAV' },
];

const BY_ID = new Map(EFFECT_SOUND_CATALOGUE.map((entry) => [entry.id, entry]));
const BY_CANONICAL_NAME = new Map(
	EFFECT_SOUND_CATALOGUE.map((entry) => [entry.canonicalName.toUpperCase(), entry]),
);

/** Look up a catalogue entry by its stable id. */
export function effectSoundCatalogueEntry(id: string): EffectSoundCatalogueEntry | undefined {
	return BY_ID.get(id);
}

/**
 * Match a saved `@_name` (from `p:snd`/`p:sndTgt`, either ours or a genuine
 * PowerPoint-authored deck's) back to its catalogue entry, tolerant of case
 * and of a missing `.WAV` extension (some third-party writers omit it).
 * Returns `undefined` for a custom (non-stock) sound file name.
 */
export function findEffectSoundCatalogueEntry(
	name: string | undefined,
): EffectSoundCatalogueEntry | undefined {
	if (!name) {
		return undefined;
	}
	const upper = name.trim().toUpperCase();
	const direct = BY_CANONICAL_NAME.get(upper);
	if (direct) {
		return direct;
	}
	const withExtension = upper.endsWith('.WAV') ? upper : `${upper}.WAV`;
	return BY_CANONICAL_NAME.get(withExtension);
}

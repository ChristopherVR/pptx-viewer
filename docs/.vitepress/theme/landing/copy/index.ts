import { useData } from 'vitepress';
import type { ComputedRef } from 'vue';
import { computed } from 'vue';

import { de } from './de';
import { en } from './en';
import { es } from './es';
import { fr } from './fr';
import type { LandingCopy } from './types';

const dictionaries: Record<string, LandingCopy> = {
	'en-US': en,
	'fr-FR': fr,
	'es-ES': es,
	'de-DE': de,
};

/** Returns the landing copy for the active VitePress locale (en fallback). */
export function useLandingCopy(): ComputedRef<LandingCopy> {
	const { lang } = useData();
	return computed(() => dictionaries[lang.value] ?? en);
}

export type { LandingCopy } from './types';

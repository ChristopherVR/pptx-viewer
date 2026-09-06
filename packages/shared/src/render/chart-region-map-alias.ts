/**
 * Region-label -> region-code alias lookup for the regionMap chart kind.
 *
 * Split out of `chart-waterfall-map.ts` (which re-exports `resolveRegionCode`)
 * to keep that file's two unrelated chart kinds (waterfall, regionMap) each
 * under the repo's per-file line budget.
 *
 * @module chart-region-map-alias
 */

/**
 * Mapping from common category label strings (country names, ISO codes) to
 * internal region keys.  Case-insensitive lookup.
 * Mirrors `REGION_ALIAS_MAP` from React's `chart-map.tsx`.
 */
const REGION_ALIAS_MAP: Record<string, string> = {
	us: 'US',
	usa: 'US',
	'united states': 'US',
	'united states of america': 'US',
	ca: 'CA',
	can: 'CA',
	canada: 'CA',
	br: 'BR',
	bra: 'BR',
	brazil: 'BR',
	gb: 'GB',
	gbr: 'GB',
	uk: 'GB',
	'united kingdom': 'GB',
	fr: 'FR',
	fra: 'FR',
	france: 'FR',
	de: 'DE',
	deu: 'DE',
	germany: 'DE',
	it: 'IT',
	ita: 'IT',
	italy: 'IT',
	es: 'ES',
	esp: 'ES',
	spain: 'ES',
	ru: 'RU',
	rus: 'RU',
	russia: 'RU',
	cn: 'CN',
	chn: 'CN',
	china: 'CN',
	in: 'IN',
	ind: 'IN',
	india: 'IN',
	jp: 'JP',
	jpn: 'JP',
	japan: 'JP',
	kr: 'KR',
	kor: 'KR',
	'south korea': 'KR',
	korea: 'KR',
	au: 'AU',
	aus: 'AU',
	australia: 'AU',
	mx: 'MX',
	mex: 'MX',
	mexico: 'MX',
	id: 'ID',
	idn: 'ID',
	indonesia: 'ID',
	tr: 'TR',
	tur: 'TR',
	turkey: 'TR',
	sa: 'SA',
	sau: 'SA',
	'saudi arabia': 'SA',
	za: 'ZA',
	zaf: 'ZA',
	'south africa': 'ZA',
	ar: 'AR',
	arg: 'AR',
	argentina: 'AR',
	ng: 'NG',
	nga: 'NG',
	nigeria: 'NG',
	eg: 'EG',
	egy: 'EG',
	egypt: 'EG',
};

/** Resolve a category label to a region key (case-insensitive). */
export function resolveRegionCode(label: string): string | undefined {
	const normalized = label.trim().toLowerCase();
	return REGION_ALIAS_MAP[normalized];
}

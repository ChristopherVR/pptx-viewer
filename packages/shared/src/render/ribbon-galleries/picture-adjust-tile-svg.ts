/**
 * The Picture Adjust tile: a small stock "photo" (sky, hill, sun, house) with
 * the preset's preview filter applied, so each Corrections / Color / Artistic
 * Effects tile shows what the preset does. A CSS filter string carries most
 * presets; duotone and black-and-white recolors get a real SVG `<filter>`
 * because CSS filter functions cannot express them. Built only from catalogue
 * data, never user input.
 *
 * @module render/ribbon-galleries/picture-adjust-tile-svg
 */
import { safeColor, svgId, svgTile } from './gallery-preview-svg';

export const PICTURE_ADJUST_TILE = { width: 56, height: 44 };

/** What a tile's preview does to the stock photo. */
export interface PictureAdjustPreview {
	/** CSS `filter` value (function list only, no `url()`). */
	css?: string;
	/** Duotone recolor: dark and light colours the luminance maps between. */
	duotone?: readonly [string, string];
	/** Black and white recolor: threshold in percent. */
	threshold?: number;
}

/** Characters a CSS filter list may contain; anything else is dropped. */
function safeCss(css: string): string {
	return /^[\w\s().,%+-]*$/u.test(css) ? css : '';
}

function hexChannels(color: string): [number, number, number] {
	const hex = safeColor(color, '#000000').replace('#', '');
	const n = Number.parseInt(hex.length === 6 ? hex : '000000', 16);
	return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function filterDefs(id: string, preview: PictureAdjustPreview): string {
	const lum =
		'0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0';
	if (preview.duotone) {
		const [dark, light] = [hexChannels(preview.duotone[0]), hexChannels(preview.duotone[1])];
		const table = (i: number) => `${dark[i].toFixed(3)} ${light[i].toFixed(3)}`;
		return `<filter id="${id}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${lum}"/><feComponentTransfer><feFuncR type="table" tableValues="${table(0)}"/><feFuncG type="table" tableValues="${table(1)}"/><feFuncB type="table" tableValues="${table(2)}"/></feComponentTransfer></filter>`;
	}
	if (typeof preview.threshold === 'number') {
		const t = Math.max(0, Math.min(100, preview.threshold)) / 100;
		const intercept = (-100 * t).toFixed(2);
		return `<filter id="${id}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${lum}"/><feComponentTransfer><feFuncR type="linear" slope="100" intercept="${intercept}"/><feFuncG type="linear" slope="100" intercept="${intercept}"/><feFuncB type="linear" slope="100" intercept="${intercept}"/></feComponentTransfer></filter>`;
	}
	return '';
}

/** One tile: the stock photo under `preview`. `key` keeps filter ids unique per tile. */
export function pictureAdjustTileSvg(key: string, preview: PictureAdjustPreview): string {
	const { width: w, height: h } = PICTURE_ADJUST_TILE;
	const id = `padj-${svgId(key)}`;
	const filter = filterDefs(`${id}-f`, preview);
	const css = preview.css ? safeCss(preview.css) : '';
	const filterAttr = filter ? ` filter="url(#${id}-f)"` : '';
	const styleAttr = css ? ` style="filter:${css}"` : '';
	const defs = `<clipPath id="${id}-c"><rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="2"/></clipPath><linearGradient id="${id}-s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5fa8ef"/><stop offset="1" stop-color="#cfe8ff"/></linearGradient>${filter}`;
	const photo =
		`<g clip-path="url(#${id}-c)"><g${filterAttr}${styleAttr}>` +
		`<rect x="2" y="2" width="${w - 4}" height="${h - 4}" fill="url(#${id}-s)"/>` +
		`<circle cx="${w - 15}" cy="13" r="5" fill="#ffd23f"/>` +
		`<path d="M2 ${h - 14} Q18 ${h - 26} 32 ${h - 16} T${w - 2} ${h - 14} V${h - 2} H2 Z" fill="#3f9b4a"/>` +
		`<path d="M2 ${h - 8} Q22 ${h - 18} ${w - 2} ${h - 7} V${h - 2} H2 Z" fill="#2a7a38"/>` +
		`<rect x="14" y="${h - 20}" width="10" height="8" fill="#d9534f"/>` +
		`<path d="M12 ${h - 20} L19 ${h - 26} L26 ${h - 20} Z" fill="#7a3b2e"/>` +
		`</g></g>`;
	const frame = `<rect x="1.5" y="1.5" width="${w - 3}" height="${h - 3}" rx="2.5" fill="none" stroke="#8a8886" stroke-width="1"/>`;
	return svgTile(w, h, defs, photo + frame);
}

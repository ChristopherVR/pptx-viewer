/**
 * SVG path data into the Edit Points pen.
 *
 * The preset engine (`evaluatePresetShape`) and a parsed freeform's
 * `pathData` are SVG strings, so converting a preset to editable points goes
 * through here. Every command SVG can express is accepted (absolute and
 * relative `M L H V C S Q T A Z`), with arcs and quadratics folded into cubics.
 *
 * @module render/edit-points/edit-points-svg
 */
import { quadToCubicControls, svgArcToCubics } from './edit-points-bezier';
import type { EditGeometryPen } from './edit-points-pen';
import type { EditPoint } from './edit-points-types';

const COMMAND_RE = /[MLHVCSQTAZ][^MLHVCSQTAZ]*/gi;
const NUMBER_RE = /[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;
const LEADING_NUMBER_RE = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/i;

/** How many numbers one repetition of each command consumes. */
const ARITY: Record<string, number> = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7 };

/** Arc flags can be written without separators (`a1 1 0 011 1`); read them one digit at a time. */
function readArcArgs(body: string): number[] {
	const out: number[] = [];
	let rest = body;
	let slot = 0;
	for (;;) {
		rest = rest.replace(/^[\s,]+/, '');
		if (rest.length === 0) {
			break;
		}
		const position = slot % 7;
		if (position === 3 || position === 4) {
			if (rest[0] !== '0' && rest[0] !== '1') {
				break;
			}
			out.push(rest[0] === '1' ? 1 : 0);
			rest = rest.slice(1);
		} else {
			const match = LEADING_NUMBER_RE.exec(rest);
			if (!match) {
				break;
			}
			out.push(Number(match[0]));
			rest = rest.slice(match[0].length);
		}
		slot++;
	}
	return out;
}

/** Walks SVG commands, tracking the cursor in SOURCE space. */
class SvgPathReader {
	private cur: EditPoint = { x: 0, y: 0 };
	private start: EditPoint = { x: 0, y: 0 };
	private lastCubic: EditPoint | null = null;
	private lastQuad: EditPoint | null = null;

	constructor(
		private readonly pen: EditGeometryPen,
		private readonly map: (point: EditPoint) => EditPoint,
	) {}

	private pt(rel: boolean, x: number, y: number): EditPoint {
		return rel ? { x: this.cur.x + x, y: this.cur.y + y } : { x, y };
	}

	private reflect(control: EditPoint | null): EditPoint {
		return control ? { x: 2 * this.cur.x - control.x, y: 2 * this.cur.y - control.y } : this.cur;
	}

	private curve(c1: EditPoint, c2: EditPoint, end: EditPoint): void {
		this.pen.curveTo(this.map(c1), this.map(c2), this.map(end));
		this.cur = end;
	}

	private line(end: EditPoint): void {
		this.pen.lineTo(this.map(end));
		this.cur = end;
		this.lastCubic = null;
		this.lastQuad = null;
	}

	close(): void {
		this.pen.close();
		this.cur = this.start;
		this.lastCubic = null;
		this.lastQuad = null;
	}

	/** One repetition of `cmd` with its arguments `a`. */
	step(cmd: string, rel: boolean, a: number[], first: boolean): void {
		switch (cmd) {
			case 'M': {
				const p = this.pt(rel, a[0], a[1]);
				if (first) {
					this.pen.moveTo(this.map(p));
					this.start = p;
					this.cur = p;
					this.lastCubic = null;
					this.lastQuad = null;
				} else {
					this.line(p);
				}
				break;
			}
			case 'L':
				this.line(this.pt(rel, a[0], a[1]));
				break;
			case 'H':
				this.line({ x: rel ? this.cur.x + a[0] : a[0], y: this.cur.y });
				break;
			case 'V':
				this.line({ x: this.cur.x, y: rel ? this.cur.y + a[0] : a[0] });
				break;
			case 'C':
			case 'S': {
				const c1 = cmd === 'C' ? this.pt(rel, a[0], a[1]) : this.reflect(this.lastCubic);
				const rest = cmd === 'C' ? a.slice(2) : a;
				const c2 = this.pt(rel, rest[0], rest[1]);
				this.curve(c1, c2, this.pt(rel, rest[2], rest[3]));
				this.lastCubic = c2;
				this.lastQuad = null;
				break;
			}
			case 'Q':
			case 'T': {
				const q = cmd === 'Q' ? this.pt(rel, a[0], a[1]) : this.reflect(this.lastQuad);
				const end = cmd === 'Q' ? this.pt(rel, a[2], a[3]) : this.pt(rel, a[0], a[1]);
				const { c1, c2 } = quadToCubicControls(this.cur, q, end);
				this.curve(c1, c2, end);
				this.lastQuad = q;
				this.lastCubic = null;
				break;
			}
			case 'A': {
				const end = this.pt(rel, a[5], a[6]);
				const from = this.cur;
				for (const piece of svgArcToCubics(from, a[0], a[1], a[2], a[3] === 1, a[4] === 1, end)) {
					this.pen.curveTo(this.map(piece.c1), this.map(piece.c2), this.map(piece.end));
				}
				this.cur = end;
				this.lastCubic = null;
				this.lastQuad = null;
				break;
			}
			default:
				break;
		}
	}
}

/**
 * Feed `d` into `pen`, mapping every coordinate through `map` (for scaling a
 * path's own coordinate space onto the element box).
 */
export function feedSvgPath(
	pen: EditGeometryPen,
	d: string,
	map: (point: EditPoint) => EditPoint = (p) => p,
): void {
	const reader = new SvgPathReader(pen, map);
	for (const token of d.match(COMMAND_RE) ?? []) {
		const letter = token[0];
		const cmd = letter.toUpperCase();
		const rel = letter !== cmd;
		if (cmd === 'Z') {
			reader.close();
			continue;
		}
		const body = token.slice(1);
		const nums = cmd === 'A' ? readArcArgs(body) : (body.match(NUMBER_RE) ?? []).map(Number);
		const arity = ARITY[cmd] ?? 0;
		if (arity === 0) {
			continue;
		}
		for (let i = 0; i + arity <= nums.length; i += arity) {
			reader.step(cmd, rel, nums.slice(i, i + arity), i === 0);
		}
	}
}

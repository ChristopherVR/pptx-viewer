/** Converts OMML XML structures to LaTeX strings. */
export class OmmlLatexConverter {
	/** Extracts LaTeX from an OMML XML node tree. */
	public convert(root: Record<string, unknown>): string {
		const rendered = this.renderNode(root).replace(/\s+/g, ' ').trim();
		if (rendered) return rendered;
		return this.collectText(root).replace(/\s+/g, ' ').trim();
	}

	private renderNode(node: unknown): string {
		if (node === null || node === undefined) return '';
		if (typeof node === 'string') return node;
		if (typeof node === 'number') return String(node);
		if (Array.isArray(node)) {
			return node.map((entry) => this.renderNode(entry)).join('');
		}
		if (typeof node !== 'object') return '';

		const record = node as Record<string, unknown>;
		if (typeof record['#text'] === 'string') return record['#text'];
		if (typeof record['m:t'] === 'string') return String(record['m:t']);
		if (record['m:t']) return this.renderNode(record['m:t']);

		const handlers: Array<(r: Record<string, unknown>) => string | null> = [
			(r) => this.tryFraction(r),
			(r) => this.trySuperscript(r),
			(r) => this.trySubscript(r),
			(r) => this.trySubSup(r),
			(r) => this.tryRadical(r),
			(r) => this.tryNary(r),
			(r) => this.tryDelimiter(r),
			(r) => this.tryMatrix(r),
			(r) => this.tryFunction(r),
			(r) => this.tryBar(r),
			(r) => this.tryGroupChar(r),
			(r) => this.tryLimLow(r),
			(r) => this.tryLimUpp(r),
		];

		for (const handler of handlers) {
			const result = handler(record);
			if (result) return result;
		}

		const ignored = new Set(['@_', 'm:rPr', 'm:ctrlPr', 'm:argPr']);
		let output = '';
		for (const [key, value] of Object.entries(record)) {
			if (ignored.has(key) || key.startsWith('@_')) continue;
			output += this.renderNode(value);
		}
		return output;
	}

	private tryFraction(node: Record<string, unknown>): string | null {
		const value = node['m:f'];
		if (!value) return null;
		const f = this.firstRecord(value);
		if (!f) return null;
		const num = this.renderNode(f['m:num']).trim();
		const den = this.renderNode(f['m:den']).trim();
		if (!num && !den) return null;
		return `\\frac{${num || ' '}}{${den || ' '}}`;
	}

	private trySuperscript(node: Record<string, unknown>): string | null {
		const value = node['m:sSup'];
		if (!value) return null;
		const sup = this.firstRecord(value);
		if (!sup) return null;
		const base = this.renderNode(sup['m:e']).trim();
		const exp = this.renderNode(sup['m:sup']).trim();
		if (!base && !exp) return null;
		return `${base}^{${exp || ' '}}`;
	}

	private trySubscript(node: Record<string, unknown>): string | null {
		const value = node['m:sSub'];
		if (!value) return null;
		const sub = this.firstRecord(value);
		if (!sub) return null;
		const base = this.renderNode(sub['m:e']).trim();
		const idx = this.renderNode(sub['m:sub']).trim();
		if (!base && !idx) return null;
		return `${base}_{${idx || ' '}}`;
	}

	private trySubSup(node: Record<string, unknown>): string | null {
		const value = node['m:sSubSup'];
		if (!value) return null;
		const ss = this.firstRecord(value);
		if (!ss) return null;
		const base = this.renderNode(ss['m:e']).trim();
		const sub = this.renderNode(ss['m:sub']).trim();
		const sup = this.renderNode(ss['m:sup']).trim();
		if (!base && !sub && !sup) return null;
		return `${base}_{${sub || ' '}}^{${sup || ' '}}`;
	}

	private tryRadical(node: Record<string, unknown>): string | null {
		const value = node['m:rad'];
		if (!value) return null;
		const rad = this.firstRecord(value);
		if (!rad) return null;
		const deg = this.renderNode(rad['m:deg']).trim();
		const expr = this.renderNode(rad['m:e']).trim();
		if (!expr && !deg) return null;
		if (deg) return `\\sqrt[${deg}]{${expr || ' '}}`;
		return `\\sqrt{${expr || ' '}}`;
	}

	private tryNary(node: Record<string, unknown>): string | null {
		const value = node['m:nary'];
		if (!value) return null;
		const nary = this.firstRecord(value);
		if (!nary) return null;

		const naryPr = this.firstRecord(nary['m:naryPr']);
		const chrNode = this.firstRecord(naryPr?.['m:chr']);
		const symbol = this.readAttr(chrNode, 'val') ?? '\\sum';
		const lower = this.renderNode(nary['m:sub']).trim();
		const upper = this.renderNode(nary['m:sup']).trim();
		const expr = this.renderNode(nary['m:e']).trim();

		let prefix = symbol;
		if (lower) prefix += `_{${lower}}`;
		if (upper) prefix += `^{${upper}}`;
		if (!expr) return prefix;
		return `${prefix} ${expr}`;
	}

	private tryDelimiter(node: Record<string, unknown>): string | null {
		const value = node['m:d'];
		if (!value) return null;
		const d = this.firstRecord(value);
		if (!d) return null;

		const dPr = this.firstRecord(d['m:dPr']);
		const begin = this.readAttr(this.firstRecord(dPr?.['m:begChr']), 'val') ?? '(';
		const end = this.readAttr(this.firstRecord(dPr?.['m:endChr']), 'val') ?? ')';
		const expr = this.renderNode(d['m:e']).trim();
		if (!expr) return null;
		return `\\left${begin}${expr}\\right${end}`;
	}

	private tryMatrix(node: Record<string, unknown>): string | null {
		const value = node['m:m'];
		if (!value) return null;
		const m = this.firstRecord(value);
		if (!m) return null;

		const rows = this.toRecordArray(m['m:mr'])
			.map((row) => {
				const cells = this.toRecordArray(row['m:e'])
					.map((entry) => this.renderNode(entry).trim())
					.filter((entry) => entry.length > 0);
				return cells.join(' & ');
			})
			.filter((row) => row.length > 0);
		if (rows.length === 0) return null;
		return `\\begin{matrix}${rows.join(' \\\\ ')}\\end{matrix}`;
	}

	/** Renders m:func (named functions like sin, cos, lim). */
	private tryFunction(node: Record<string, unknown>): string | null {
		const value = node['m:func'];
		if (!value) return null;
		const func = this.firstRecord(value);
		if (!func) return null;
		const name = this.renderNode(func['m:fName']).trim();
		const expr = this.renderNode(func['m:e']).trim();
		if (!name) return null;
		return `\\${name}{${expr || ' '}}`;
	}

	/** Renders m:bar (overline / underline). */
	private tryBar(node: Record<string, unknown>): string | null {
		const value = node['m:bar'];
		if (!value) return null;
		const bar = this.firstRecord(value);
		if (!bar) return null;
		const barPr = this.firstRecord(bar['m:barPr']);
		const pos = this.readAttr(this.firstRecord(barPr?.['m:pos']), 'val');
		const expr = this.renderNode(bar['m:e']).trim();
		if (!expr) return null;
		return pos === 'bot'
			? `\\underline{${expr}}`
			: `\\overline{${expr}}`;
	}

	/** Renders m:groupChr (brace/bracket above or below expression). */
	private tryGroupChar(node: Record<string, unknown>): string | null {
		const value = node['m:groupChr'];
		if (!value) return null;
		const gc = this.firstRecord(value);
		if (!gc) return null;
		const gcPr = this.firstRecord(gc['m:groupChrPr']);
		const pos = this.readAttr(this.firstRecord(gcPr?.['m:pos']), 'val');
		const chr = this.readAttr(this.firstRecord(gcPr?.['m:chr']), 'val') ?? '⏟';
		const expr = this.renderNode(gc['m:e']).trim();
		if (!expr) return null;
		if (pos === 'top' || chr === '⏞') {
			return `\\overbrace{${expr}}`;
		}
		return `\\underbrace{${expr}}`;
	}

	/** Renders m:limLow (lower limit, e.g. lim_{x->0}). */
	private tryLimLow(node: Record<string, unknown>): string | null {
		const value = node['m:limLow'];
		if (!value) return null;
		const ll = this.firstRecord(value);
		if (!ll) return null;
		const base = this.renderNode(ll['m:e']).trim();
		const lim = this.renderNode(ll['m:lim']).trim();
		if (!base) return null;
		return lim ? `${base}_{${lim}}` : base;
	}

	/** Renders m:limUpp (upper limit). */
	private tryLimUpp(node: Record<string, unknown>): string | null {
		const value = node['m:limUpp'];
		if (!value) return null;
		const lu = this.firstRecord(value);
		if (!lu) return null;
		const base = this.renderNode(lu['m:e']).trim();
		const lim = this.renderNode(lu['m:lim']).trim();
		if (!base) return null;
		return lim ? `${base}^{${lim}}` : base;
	}

	private collectText(node: unknown): string {
		if (node === null || node === undefined) return '';
		if (typeof node === 'string' || typeof node === 'number')
			return String(node);
		if (Array.isArray(node)) {
			return node.map((entry) => this.collectText(entry)).join(' ');
		}
		if (typeof node !== 'object') return '';

		const record = node as Record<string, unknown>;
		const tokens: string[] = [];
		if (typeof record['m:t'] === 'string') tokens.push(record['m:t']);
		if (typeof record['#text'] === 'string') tokens.push(record['#text']);
		for (const [key, value] of Object.entries(record)) {
			if (key === 'm:t' || key === '#text' || key.startsWith('@_'))
				continue;
			tokens.push(this.collectText(value));
		}
		return tokens.join(' ');
	}

	private firstRecord(value: unknown): Record<string, unknown> | null {
		if (Array.isArray(value)) {
			for (const entry of value) {
				if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
					return entry as Record<string, unknown>;
				}
			}
			return null;
		}
		if (value && typeof value === 'object') {
			return value as Record<string, unknown>;
		}
		return null;
	}

	private toRecordArray(value: unknown): Array<Record<string, unknown>> {
		if (!value) return [];
		if (Array.isArray(value)) {
			return value.filter(
				(entry): entry is Record<string, unknown> =>
					Boolean(entry) &&
					typeof entry === 'object' &&
					!Array.isArray(entry)
			);
		}
		if (typeof value === 'object') {
			return [value as Record<string, unknown>];
		}
		return [];
	}

	private readAttr(
		node: Record<string, unknown> | null,
		key: string
	): string | null {
		if (!node) return null;
		const direct = node[`@_${key}`];
		if (typeof direct === 'string') return direct;
		const fallback = node[key];
		if (typeof fallback === 'string') return fallback;
		return null;
	}
}

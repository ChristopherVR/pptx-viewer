import type {
	PptxElement,
	PptxTableCell,
	PptxTableCellStyle,
	PptxTableData,
	TablePptxElement,
	TextSegment,
} from '../../core';
import type {
	ElementProcessor,
	ElementProcessorContext,
} from './ElementProcessor';

export class TableElementProcessor implements ElementProcessor {
	public readonly supportedTypes = ['table'] as const;

	public async process(
		element: PptxElement,
		ctx: ElementProcessorContext
	): Promise<string | null> {
		if (element.type !== 'table') return null;
		const tableElement: TablePptxElement = element;
		const tableData = tableElement.tableData;
		if (!tableData || tableData.rows.length === 0) return null;

		// In semantic mode, try to render as markdown table if possible
		if (ctx.semanticMode && this.canRenderAsMarkdownTable(tableData)) {
			return this.renderMarkdownTable(tableData);
		}

		const rowSpanOccupancy = new Map<number, Set<number>>();
		const htmlRows: string[] = [];

		for (let ri = 0; ri < tableData.rows.length; ri++) {
			const row = tableData.rows[ri];
			const isHeader =
				ri === 0 && tableData.firstRowHeader !== false;
			const tag = isHeader ? 'th' : 'td';
			const cells: string[] = [];
			let ci = 0;

			for (const cell of row.cells) {
				while (this.isOccupied(rowSpanOccupancy, ri, ci)) {
					ci++;
				}

				const gridSpan = Math.max(1, cell.gridSpan ?? 1);
				if (cell.vMerge || cell.hMerge) {
					ci += gridSpan;
					continue;
				}

				const rowSpan = Math.max(1, cell.rowSpan ?? 1);
				if (rowSpan > 1) {
					for (let ro = 1; ro < rowSpan; ro++) {
						for (let s = 0; s < gridSpan; s++) {
							this.markOccupied(
								rowSpanOccupancy, ri + ro, ci + s
							);
						}
					}
				}

				const attrs = this.buildCellAttrs(
					cell, gridSpan, rowSpan, isHeader
				);
				const content = this.renderCellContent(cell);
				cells.push(`<${tag}${attrs}>${content}</${tag}>`);
				ci += gridSpan;
			}

			if (cells.length > 0) {
				htmlRows.push(`<tr>${cells.join('')}</tr>`);
			}
		}

		if (htmlRows.length === 0) return null;
		return `<table>\n${htmlRows.join('\n')}\n</table>`;
	}

	/** Builds inline-style + colspan/rowspan attributes for a cell. */
	private buildCellAttrs(
		cell: PptxTableCell,
		gridSpan: number,
		rowSpan: number,
		isHeader: boolean
	): string {
		const parts: string[] = [];
		if (gridSpan > 1) parts.push(` colspan="${gridSpan}"`);
		if (rowSpan > 1) parts.push(` rowspan="${rowSpan}"`);

		const css = this.buildCellCss(cell.style, isHeader);
		if (css) parts.push(` style="${css}"`);
		return parts.join('');
	}

	/** Converts PptxTableCellStyle to an inline CSS string. */
	private buildCellCss(
		style: PptxTableCellStyle | undefined,
		isHeader: boolean
	): string {
		const rules: string[] = [];
		if (style?.backgroundColor) {
			rules.push(`background:${style.backgroundColor}`);
		}
		if (style?.align) {
			rules.push(`text-align:${style.align}`);
		}
		if (style?.vAlign) {
			rules.push(`vertical-align:${style.vAlign}`);
		}
		if (style?.fontSize) {
			rules.push(`font-size:${Math.round(style.fontSize)}px`);
		}
		if (style?.color) {
			rules.push(`color:${style.color}`);
		}
		if (style?.bold || isHeader) {
			rules.push('font-weight:bold');
		}
		if (style?.italic) {
			rules.push('font-style:italic');
		}

		// Borders.
		const border = this.buildBorderCss(style);
		if (border) rules.push(border);

		// Padding from cell margins.
		const padding = this.buildPaddingCss(style);
		if (padding) rules.push(padding);

		return rules.join(';');
	}

	/** Builds per-edge border CSS from cell style. */
	private buildBorderCss(
		style: PptxTableCellStyle | undefined
	): string {
		if (!style) return '';
		const edges: string[] = [];
		if (style.borderTopWidth && style.borderTopColor) {
			edges.push(
				`border-top:${style.borderTopWidth}px solid ${style.borderTopColor}`
			);
		}
		if (style.borderBottomWidth && style.borderBottomColor) {
			edges.push(
				`border-bottom:${style.borderBottomWidth}px solid ${style.borderBottomColor}`
			);
		}
		if (style.borderLeftWidth && style.borderLeftColor) {
			edges.push(
				`border-left:${style.borderLeftWidth}px solid ${style.borderLeftColor}`
			);
		}
		if (style.borderRightWidth && style.borderRightColor) {
			edges.push(
				`border-right:${style.borderRightWidth}px solid ${style.borderRightColor}`
			);
		}
		if (edges.length === 0 && style.borderColor) {
			return `border:1px solid ${style.borderColor}`;
		}
		return edges.join(';');
	}

	/** Builds padding CSS from cell margin values. */
	private buildPaddingCss(
		style: PptxTableCellStyle | undefined
	): string {
		if (!style) return '';
		const t = style.marginTop ?? 0;
		const r = style.marginRight ?? 0;
		const b = style.marginBottom ?? 0;
		const l = style.marginLeft ?? 0;
		if (t === 0 && r === 0 && b === 0 && l === 0) return '';
		return `padding:${t}px ${r}px ${b}px ${l}px`;
	}

	/**
	 * Renders cell content as HTML spans preserving per-run styling
	 * (font-family, font-size, color, bold, italic).
	 */
	private renderCellContent(cell: PptxTableCell): string {
		const segments = this.getCellSegments(cell);
		if (segments.length === 0) {
			return this.escapeHtml(cell.text ?? '');
		}

		const parts: string[] = [];
		for (const seg of segments) {
			if (seg.isParagraphBreak) {
				parts.push('<br>');
				continue;
			}
			const text = this.escapeHtml(seg.text);
			if (!text) continue;

			const css = this.buildRunCss(seg, cell.style);
			if (css) {
				parts.push(`<span style="${css}">${text}</span>`);
			} else {
				parts.push(text);
			}
		}
		return parts.join('');
	}

	/** Builds inline CSS for a single text run, only for properties that
	 *  differ from the cell-level defaults. */
	private buildRunCss(
		seg: TextSegment,
		cellStyle: PptxTableCellStyle | undefined
	): string {
		const s = seg.style;
		const rules: string[] = [];

		if (s.fontFamily) {
			rules.push(`font-family:"${s.fontFamily}",sans-serif`);
		}
		// Only emit run-level font-size if it differs from the cell default.
		if (s.fontSize && s.fontSize !== cellStyle?.fontSize) {
			rules.push(`font-size:${Math.round(s.fontSize)}px`);
		}
		if (s.color && s.color !== cellStyle?.color) {
			rules.push(`color:${s.color}`);
		}
		if (s.bold && !cellStyle?.bold) {
			rules.push('font-weight:bold');
		}
		if (s.italic && !cellStyle?.italic) {
			rules.push('font-style:italic');
		}
		if (s.underline) {
			rules.push('text-decoration:underline');
		}
		if (s.strikethrough) {
			rules.push('text-decoration:line-through');
		}

		return rules.join(';');
	}

	/** Extracts typed TextSegment[] from a cell if present. */
	private getCellSegments(cell: PptxTableCell): TextSegment[] {
		const raw = (cell as unknown as { textSegments?: unknown })
			.textSegments;
		if (!Array.isArray(raw)) return [];
		return raw.filter(
			(s): s is TextSegment =>
				!!s &&
				typeof s === 'object' &&
				typeof (s as Record<string, unknown>).text === 'string'
		);
	}

	private escapeHtml(text: string): string {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;');
	}

	private markOccupied(
		occupancy: Map<number, Set<number>>,
		row: number,
		column: number
	): void {
		const set = occupancy.get(row) ?? new Set<number>();
		set.add(column);
		occupancy.set(row, set);
	}

	private isOccupied(
		occupancy: Map<number, Set<number>>,
		row: number,
		column: number
	): boolean {
		return occupancy.get(row)?.has(column) ?? false;
	}

	/**
	 * Returns true if the table can be rendered as a simple markdown table
	 * (no merged cells, no row spans, no col spans > 1).
	 */
	private canRenderAsMarkdownTable(tableData: PptxTableData): boolean {
		for (const row of tableData.rows) {
			for (const cell of row.cells) {
				if (cell.vMerge || cell.hMerge) return false;
				if ((cell.gridSpan ?? 1) > 1) return false;
				if ((cell.rowSpan ?? 1) > 1) return false;
			}
		}
		return true;
	}

	/** Render a simple table as markdown (no merges/spans). */
	private renderMarkdownTable(tableData: PptxTableData): string {
		const rows = tableData.rows;
		if (rows.length === 0) return '';

		const columnCount = Math.max(
			...rows.map((r) => r.cells.length)
		);

		const mdRows: string[] = [];
		const hasHeader = tableData.firstRowHeader !== false;

		for (let ri = 0; ri < rows.length; ri++) {
			const cells = rows[ri].cells.map((cell) => {
				const text = this.getCellPlainText(cell);
				return this.escapeMarkdownTableCell(text);
			});
			// Pad to column count
			while (cells.length < columnCount) {
				cells.push('');
			}
			mdRows.push(`| ${cells.join(' | ')} |`);

			// Insert divider after header row
			if (ri === 0 && hasHeader) {
				const divider = Array.from(
					{ length: columnCount },
					() => '---'
				);
				mdRows.push(`| ${divider.join(' | ')} |`);
			}
		}

		// If no header row, prepend empty header + divider
		if (!hasHeader) {
			const emptyHeader = Array.from(
				{ length: columnCount },
				() => ''
			);
			const divider = Array.from(
				{ length: columnCount },
				() => '---'
			);
			mdRows.unshift(
				`| ${emptyHeader.join(' | ')} |`,
				`| ${divider.join(' | ')} |`
			);
		}

		return mdRows.join('\n');
	}

	private getCellPlainText(cell: PptxTableCell): string {
		const segments = this.getCellSegments(cell);
		if (segments.length === 0) return cell.text ?? '';
		return segments
			.map((s) => (s.isParagraphBreak ? ' ' : s.text))
			.join('')
			.trim();
	}

	private escapeMarkdownTableCell(text: string): string {
		return text
			.replace(/\|/g, '\\|')
			.replace(/\n+/g, ' ')
			.trim();
	}
}

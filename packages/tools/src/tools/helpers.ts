import { hasTextProperties } from 'pptx-viewer-core';
import type { PptxSlide, PptxElement, TablePptxElement } from 'pptx-viewer-core';

export function generateElementId(): string {
	return `el-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function generateSlideId(): string {
	return `slide-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Build a concise text representation of a slide element for tool output. */
export function describeElement(el: PptxElement): Record<string, unknown> {
	const base: Record<string, unknown> = {
		id: el.id,
		type: el.type,
		x: Math.round(el.x),
		y: Math.round(el.y),
		width: Math.round(el.width),
		height: Math.round(el.height),
	};

	if (el.rotation) {
		base.rotation = el.rotation;
	}
	if (el.hidden) {
		base.hidden = true;
	}
	if (el.opacity !== undefined && el.opacity !== 1) {
		base.opacity = el.opacity;
	}

	if (hasTextProperties(el)) {
		base.text = el.text ?? '';
		if (el.textStyle) {
			const ts: Record<string, unknown> = {};
			if (el.textStyle.fontSize) {
				ts.fontSize = el.textStyle.fontSize;
			}
			if (el.textStyle.fontFamily) {
				ts.fontFamily = el.textStyle.fontFamily;
			}
			if (el.textStyle.bold) {
				ts.bold = true;
			}
			if (el.textStyle.italic) {
				ts.italic = true;
			}
			if (el.textStyle.underline) {
				ts.underline = el.textStyle.underline;
			}
			if (el.textStyle.align) {
				ts.align = el.textStyle.align;
			}
			if (el.textStyle.color) {
				ts.color = el.textStyle.color;
			}
			if (Object.keys(ts).length > 0) {
				base.textStyle = ts;
			}
		}
	}

	if ('shapeType' in el && el.shapeType) {
		base.shapeType = el.shapeType;
	}
	if ('shapeStyle' in el && el.shapeStyle) {
		const ss: Record<string, unknown> = {};
		const style = el.shapeStyle as Record<string, unknown>;
		if (style.fillColor) {
			ss.fillColor = style.fillColor;
		}
		if (style.strokeColor) {
			ss.strokeColor = style.strokeColor;
		}
		if (style.strokeWidth) {
			ss.strokeWidth = style.strokeWidth;
		}
		if (Object.keys(ss).length > 0) {
			base.shapeStyle = ss;
		}
	}

	if (el.type === 'image' || el.type === 'picture') {
		const img = el as { altText?: string; imagePath?: string; imageData?: string };
		if (img.altText) {
			base.altText = img.altText;
		}
		if (img.imagePath) {
			base.imagePath = img.imagePath;
		}
		base.hasImageData = Boolean(img.imageData);
	}

	if (el.type === 'table') {
		const tbl = el as TablePptxElement;
		if (tbl.tableData) {
			base.rowCount = tbl.tableData.rows.length;
			base.columnCount = tbl.tableData.columnWidths.length;
			base.cells = tbl.tableData.rows.map((row) => row.cells.map((cell) => cell.text ?? ''));
		}
	}

	if (el.type === 'chart') {
		base.chartType = (el as { chartData?: { type?: string } }).chartData?.type;
	}

	if (el.type === 'group') {
		const grp = el as { children?: PptxElement[] };
		base.childCount = grp.children?.length ?? 0;
	}

	return base;
}

/** Extract text from a slide's elements for search purposes. */
export function extractSlideText(slide: PptxSlide): string {
	const texts: string[] = [];
	for (const el of slide.elements) {
		if (hasTextProperties(el) && el.text) {
			texts.push(el.text);
		}
		if (el.type === 'table') {
			const tbl = el as TablePptxElement;
			if (tbl.tableData) {
				for (const row of tbl.tableData.rows) {
					for (const cell of row.cells) {
						if (cell.text) {
							texts.push(cell.text);
						}
					}
				}
			}
		}
	}
	if (slide.notes) {
		texts.push(slide.notes);
	}
	return texts.join(' ');
}

/** Validate slideIndex is within range, return error string or null. */
export function validateSlideIndex(slideIndex: number, slideCount: number): string | null {
	if (slideIndex < 0 || slideIndex >= slideCount) {
		return `Slide index ${slideIndex} out of range (0\u2013${slideCount - 1}).`;
	}
	return null;
}

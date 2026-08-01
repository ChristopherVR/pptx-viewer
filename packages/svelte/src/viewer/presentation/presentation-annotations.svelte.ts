import type { InkPoint } from 'pptx-viewer-shared';
import { strokeToInkElement } from 'pptx-viewer-shared';

import type { EditorState } from '../editor/editor-state.svelte';

export type PresentationInkTool = 'none' | 'pen' | 'highlighter' | 'eraser' | 'laser';
export interface PresentationStroke {
	id: string;
	points: InkPoint[];
	color: string;
	width: number;
	tool: 'pen' | 'highlighter';
}

export class PresentationAnnotations {
	tool = $state<PresentationInkTool>('none');
	/**
	 * Pen and highlighter carry SEPARATE colours, as they do in PowerPoint and
	 * in every other binding. This used to be one `color` field with the
	 * highlighter hardcoded to `#fde047`, which made the show toolbar's
	 * highlighter palette a lie: picking a colour changed the pen instead.
	 * The defaults are `PEN_COLORS[0]` and `HIGHLIGHTER_COLORS[0]`.
	 */
	penColor = $state('#ff0000');
	highlighterColor = $state('#ffff00');
	current = $state.raw<PresentationStroke | null>(null);
	bySlide = $state.raw<Map<number, PresentationStroke[]>>(new Map());
	laser = $state.raw<InkPoint | null>(null);
	#sequence = 0;

	get count(): number {
		return [...this.bySlide.values()].reduce((sum, strokes) => sum + strokes.length, 0);
	}
	get slideCount(): number {
		return this.bySlide.size;
	}
	strokes(index: number): PresentationStroke[] {
		return this.bySlide.get(index) ?? [];
	}

	pointerDown(index: number, point: InkPoint): void {
		if (this.tool === 'eraser') {
			this.erase(index, point);
			return;
		}
		if (this.tool !== 'pen' && this.tool !== 'highlighter') {
			return;
		}
		this.current = {
			id: `presentation-${++this.#sequence}`,
			points: [point],
			color: this.tool === 'highlighter' ? this.highlighterColor : this.penColor,
			width: this.tool === 'highlighter' ? 14 : 2.5,
			tool: this.tool,
		};
	}
	pointerMove(index: number, point: InkPoint): void {
		if (this.tool === 'laser') {
			this.laser = point;
			return;
		}
		if (this.tool === 'eraser') {
			this.erase(index, point);
			return;
		}
		if (this.current) {
			this.current = { ...this.current, points: [...this.current.points, point] };
		}
	}
	pointerUp(index: number): void {
		const stroke = this.current;
		this.current = null;
		if (!stroke || stroke.points.length < 2) {
			return;
		}
		const next = new Map(this.bySlide);
		next.set(index, [...(next.get(index) ?? []), stroke]);
		this.bySlide = next;
	}
	erase(index: number, point: InkPoint): void {
		const strokes = this.strokes(index).filter(
			(stroke) => !stroke.points.some((p) => Math.hypot(p.x - point.x, p.y - point.y) < 16),
		);
		const next = new Map(this.bySlide);
		if (strokes.length) {
			next.set(index, strokes);
		} else {
			next.delete(index);
		}
		this.bySlide = next;
	}
	clear(): void {
		this.current = null;
		this.laser = null;
		this.bySlide = new Map();
		this.tool = 'none';
	}
	keep(editor: EditorState): void {
		let slides = editor.slides;
		for (const [index, strokes] of this.bySlide) {
			const ink = strokes
				.map((stroke) => strokeToInkElement(stroke))
				.filter((item) => item !== null);
			if (ink.length && slides[index]) {
				slides = slides.map((slide, i) =>
					i === index ? { ...slide, elements: [...slide.elements, ...ink] } : slide,
				);
			}
		}
		if (slides !== editor.slides) {
			editor.commitSlides(slides);
		}
		this.clear();
	}
}

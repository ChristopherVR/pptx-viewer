import type { EditorState } from '../editor/editor-state.svelte';

export class RehearseState {
	active = $state(false);
	paused = $state(false);
	summaryOpen = $state(false);
	times = $state.raw<Map<number, number>>(new Map());
	current = $state(0);
	elapsedMs = $state(0);
	#startedAt = 0;
	#pauseStarted = 0;
	#pausedTotal = 0;
	start(index: number): void {
		this.times = new Map();
		this.current = index;
		this.elapsedMs = 0;
		this.#startedAt = Date.now();
		this.#pausedTotal = 0;
		this.active = true;
		this.paused = false;
		this.summaryOpen = false;
	}
	tick(): void {
		if (this.active && !this.paused) {
			this.elapsedMs = Date.now() - this.#startedAt - this.#pausedTotal;
		}
	}
	move(index: number): void {
		if (!this.active || index === this.current) {
			return;
		}
		this.record();
		this.current = index;
		this.#startedAt = Date.now();
		this.#pausedTotal = 0;
		this.elapsedMs = 0;
	}
	togglePause(): void {
		if (!this.active) {
			return;
		}
		if (this.paused) {
			this.#pausedTotal += Date.now() - this.#pauseStarted;
			this.paused = false;
		} else {
			this.#pauseStarted = Date.now();
			this.paused = true;
		}
	}
	finish(): void {
		if (!this.active) {
			return;
		}
		this.record();
		this.active = false;
		this.paused = false;
		this.summaryOpen = true;
	}
	record(): void {
		const next = new Map(this.times);
		next.set(this.current, Math.max(1000, this.elapsedMs));
		this.times = next;
	}
	save(editor: EditorState): void {
		editor.commitSlides(
			editor.slides.map((slide, index) =>
				this.times.has(index)
					? {
							...slide,
							transition: {
								type: slide.transition?.type ?? 'none',
								...slide.transition,
								advanceAfterMs: this.times.get(index),
								advanceOnClick: true,
							},
						}
					: slide,
			),
		);
		this.summaryOpen = false;
	}
	discard(): void {
		this.times = new Map();
		this.summaryOpen = false;
	}
	get totalMs(): number {
		return [...this.times.values()].reduce((sum, value) => sum + value, 0);
	}
}

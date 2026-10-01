/**
 * ribbon-animations-section.component.ts: the Animations ribbon tab, a thin
 * adapter over the shared `pptx-ui-ribbon-animations` view (Preview, the
 * always-visible preset and motion-path galleries, Advanced Animation and the
 * inert Timing fields). Animation edits go through the immutable helpers in
 * animation-author-helpers.ts and commit via {@link EditorStateService}, so
 * document mutation, history and the inspector lifecycle stay native here.
 */
import {
	ChangeDetectionStrategy,
	Component,
	CUSTOM_ELEMENTS_SCHEMA,
	inject,
	input,
	output,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type {
	PptxAnimationPreset,
	PptxElement,
	PptxElementAnimation,
	PptxSlide,
} from 'pptx-viewer-core';

import { applyMotionPathPreset, playAnimationRibbonPreview } from '../internal/shared';
import type { AnimationGroup, RibbonAnimationsRequestEvent } from '../internal/shared';
import {
	removeAnimation,
	setAnimationEmphasis,
	setAnimationEntrance,
	setAnimationExit,
} from './animation-author-helpers';
import { EditorStateService } from './editor-state.service';

export function canAuthorAnimation(canEdit: boolean, hasSelection: boolean): boolean {
	return canEdit && hasSelection;
}

/** The selected element's own animation entry, the one the Preview button plays. */
export function findSelectedAnimation(
	animations: readonly PptxElementAnimation[] | undefined,
	elementId: string | undefined,
): PptxElementAnimation | undefined {
	if (!elementId) {
		return undefined;
	}
	return animations?.find((a) => a.elementId === elementId);
}

@Component({
	selector: 'pptx-ribbon-animations-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	template: `<pptx-ui-ribbon-animations [state]="view()" (animations-request)="request($event)" />`,
})
export class RibbonAnimationsSectionComponent {
	private readonly editor = inject(EditorStateService);
	private readonly translation = inject(TranslateService, { optional: true });

	readonly slideIndex = input<number>(0);
	readonly selectedElement = input<PptxElement | null>(null);
	readonly canEdit = input<boolean>(false);
	/** Whether the inspector is open; reflected as the Animation Pane's pressed state. */
	readonly inspectorOpen = input<boolean>(false);

	/** "Animation Panel": open the inspector and expand its Animation section. */
	readonly openAnimationPanel = output<void>();

	protected hasSel(): boolean {
		return this.editor.selectedIds().length > 0;
	}

	protected canAuthor(): boolean {
		return canAuthorAnimation(this.canEdit(), this.hasSel());
	}

	protected view() {
		return {
			editable: this.canEdit(),
			hasSelection: this.hasSel(),
			paneOpen: this.inspectorOpen(),
			translate: (key: string) => this.translation?.instant(key) ?? key,
		};
	}

	protected request(event: Event): void {
		const intent = (event as RibbonAnimationsRequestEvent).detail;
		if (intent.kind === 'add') {
			if (intent.group === 'motionPath') {
				this.applyMotionPath(intent.preset);
			} else {
				this.addAnimation(intent.preset as PptxAnimationPreset, intent.group);
			}
		} else if (intent.value === 'preview') {
			this.previewAnimation();
		} else if (intent.value === 'remove') {
			this.removeAnim();
		} else {
			this.openAnimationPanel.emit();
		}
	}

	/**
	 * Play the selected element's own authored effect in place on the canvas,
	 * via the shared player also used by react/vue/svelte/vanilla's ribbons.
	 * A no-op (matching those four) when the selection has no animation entry
	 * to preview.
	 */
	protected previewAnimation(): void {
		if (!this.canAuthor()) {
			return;
		}
		const el = this.selectedElement();
		if (!el) {
			return;
		}
		const slide = this.editor.slides()[this.slideIndex()];
		playAnimationRibbonPreview(document, findSelectedAnimation(slide?.animations, el.id));
	}

	/**
	 * Apply a catalogue motion path to the selected element.
	 *
	 * Separate from {@link addAnimation} because a path is written to the
	 * `motionPath` field of the SAME animation entry the preset buckets use, not
	 * to one of those buckets: applying a path must not wipe an entrance the
	 * element already carries, and clearing that entrance later must not wipe
	 * the path. The shared helper owns both rules.
	 */
	protected applyMotionPath(presetId: string): void {
		const slide = this.target();
		if (!slide) {
			return;
		}
		const updated = applyMotionPathPreset(slide.animations ?? [], slide.elementId, presetId);
		this.editor.updateSlide(this.slideIndex(), { animations: updated } as Partial<PptxSlide>);
	}

	/**
	 * Add an animation preset to the selected element on the active slide.
	 * Delegates to the immutable helpers in animation-author-helpers.ts and
	 * commits the updated animations array via EditorStateService.updateSlide.
	 */
	protected addAnimation(preset: PptxAnimationPreset, group: AnimationGroup): void {
		const slide = this.target();
		if (!slide) {
			return;
		}
		const current = slide.animations ?? [];
		const updated =
			group === 'entrance'
				? setAnimationEntrance(current, slide.elementId, preset)
				: group === 'emphasis'
					? setAnimationEmphasis(current, slide.elementId, preset)
					: setAnimationExit(current, slide.elementId, preset);
		this.editor.updateSlide(this.slideIndex(), { animations: updated } as Partial<PptxSlide>);
	}

	/** Remove all animations from the selected element. */
	protected removeAnim(): void {
		const slide = this.target();
		if (!slide) {
			return;
		}
		const updated = removeAnimation(slide.animations ?? [], slide.elementId);
		this.editor.updateSlide(this.slideIndex(), { animations: updated } as Partial<PptxSlide>);
	}

	/** The editable slide's animations and the selected element id, or undefined to no-op. */
	private target() {
		if (!this.canEdit()) {
			return undefined;
		}
		const el = this.selectedElement();
		const slide = this.editor.slides()[this.slideIndex()];
		return el && slide ? { elementId: el.id, animations: slide.animations } : undefined;
	}
}

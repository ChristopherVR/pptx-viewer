/**
 * ribbon-transitions-section.component.ts: the Transitions ribbon tab, a thin
 * adapter for the shared `pptx-ui-ribbon-transitions`. The shared element owns
 * every control, label, pressed state and read-only gating; this component
 * derives the draft from the ACTIVE slide (`readRibbonTransitionDraft`), writes
 * each change onto the targeted slides through the native editor service
 * (history and persistence stay here), replays the transition on the stage for
 * Preview without writing, and applies sound picks as raw transition patches.
 */
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	CUSTOM_ELEMENTS_SCHEMA,
	inject,
	input,
	output,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import type { PptxSlideTransition } from 'pptx-viewer-core';

import type { RibbonTransitionDraft, RibbonTransitionsRequestEvent } from '../internal/shared';
import {
	applyRibbonTransitionDraft,
	mergeSlideTransition,
	playSlideTransitionPreview,
	readRibbonTransitionDraft,
	ribbonTransitionsDraftPatch,
	ribbonTransitionsSoundChange,
	ribbonTransitionStockSoundUrl,
	ribbonTransitionTargets,
} from '../internal/shared';
import { playAnimationSound } from './animation-sound';
import { EditorStateService } from './editor-state.service';

@Component({
	selector: 'pptx-ribbon-transitions-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	template: `<pptx-ui-ribbon-transitions
		[state]="view()"
		(transitions-request)="request($event)"
	/>`,
})
export class RibbonTransitionsSectionComponent {
	private readonly editor = inject(EditorStateService);
	private readonly translation = inject(TranslateService, { optional: true });

	readonly slideIndex = input<number>(0);
	readonly canEdit = input<boolean>(true);
	readonly inspectorOpen = input<boolean>(false);
	readonly toggleInspector = output<void>();

	private readonly slide = computed(() => this.editor.slides()[this.slideIndex()]);
	/** `readRibbonTransitionDraft` answers the empty draft for a missing slide. */
	protected readonly draft = computed(() => readRibbonTransitionDraft(this.slide()));

	protected view() {
		return {
			draft: this.draft(),
			transition: this.slide()?.transition,
			editable: this.canEdit(),
			inspectorOpen: this.inspectorOpen(),
			translate: (key: string, params?: Record<string, string>) =>
				this.translation?.instant(key, params) ?? key,
		};
	}

	protected request(event: Event): void {
		const intent = (event as RibbonTransitionsRequestEvent).detail;
		const patch = ribbonTransitionsDraftPatch(intent);
		if (patch) {
			this.commit(patch);
			return;
		}
		switch (intent.kind) {
			case 'preview':
				playSlideTransitionPreview(this.slide()?.transition, document);
				break;
			case 'applyToAll':
				this.commit({}, true);
				break;
			case 'inspector':
				this.toggleInspector.emit();
				break;
			case 'soundPreview': {
				const url = ribbonTransitionStockSoundUrl(this.slide()?.transition);
				if (url) {
					playAnimationSound(url);
				}
				break;
			}
			default:
				void ribbonTransitionsSoundChange(intent).then((change) => {
					if (change) {
						this.commitSound(change);
					}
					return undefined;
				});
		}
	}

	/** `updateSlide` replaces `transition` wholesale, so a sound change is pre-merged. */
	private commitSound(changes: Partial<PptxSlideTransition>): void {
		const index = this.slideIndex();
		const slide = this.editor.slides()[index];
		if (slide && this.canEdit()) {
			this.editor.updateSlide(index, {
				transition: mergeSlideTransition(slide.transition, changes),
			});
		}
	}

	/** Write the draft onto the targeted slides, keeping each one's direction/sound/raw XML. */
	private commit(patch: Partial<RibbonTransitionDraft>, applyToAll = false): void {
		if (!this.canEdit()) {
			return;
		}
		const index = this.slideIndex();
		const next: RibbonTransitionDraft = { ...this.draft(), ...patch };
		const slides = this.editor.slides();
		for (const target of ribbonTransitionTargets(slides.length, index, applyToAll)) {
			this.editor.updateSlide(target, {
				transition: applyRibbonTransitionDraft(slides[target], next),
			});
		}
	}
}

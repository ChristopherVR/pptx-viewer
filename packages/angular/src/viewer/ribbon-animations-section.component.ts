/**
 * ribbon-animations-section.component.ts: the Animations ribbon tab (Preview,
 * the entrance/emphasis/exit gallery, the Advanced Animation group, and the
 * Timing group). Split out of {@link RibbonComponent}. Animation edits go
 * through the immutable helpers in animation-author-helpers.ts and commit via
 * {@link EditorStateService}.
 *
 * The preset gallery sits ON the ribbon rather than behind an "Add Animation"
 * dropdown. PowerPoint puts it there, every other binding does too, and a
 * control that only exists inside a hover menu cannot be reached by name, which
 * is how this tab silently drifted out of parity. The gallery itself is
 * {@link RibbonAnimationGalleryComponent}, which renders the whole shared
 * catalogue.
 */
import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import {
	LucideClock3,
	LucideMousePointerClick,
	LucideMoveRight,
	LucidePaintbrush,
	LucidePanelRight,
	LucidePlay,
	LucideSparkles,
	LucideStar,
	LucideTrash2,
} from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxAnimationPreset, PptxElement, PptxSlide } from 'pptx-viewer-core';

import { DEFAULT_MOTION_PATH_PRESET_ID, applyMotionPathPreset } from '../internal/shared';
import type { AnimationGroup } from '../internal/shared';
import {
	removeAnimation,
	setAnimationEmphasis,
	setAnimationEntrance,
	setAnimationExit,
} from './animation-author-helpers';
import { EditorStateService } from './editor-state.service';
import type { AnimationPresetPick } from './ribbon-animation-gallery.component';
import { RibbonAnimationGalleryComponent } from './ribbon-animation-gallery.component';
import { RibbonMotionPathGalleryComponent } from './ribbon-motion-path-gallery.component';

export function canAuthorAnimation(canEdit: boolean, hasSelection: boolean): boolean {
	return canEdit && hasSelection;
}

@Component({
	selector: 'pptx-ribbon-animations-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [
		TranslatePipe,
		LucidePlay,
		LucideSparkles,
		LucideStar,
		LucideMoveRight,
		LucideMousePointerClick,
		LucidePaintbrush,
		LucideClock3,
		LucideTrash2,
		LucidePanelRight,
		RibbonAnimationGalleryComponent,
		RibbonMotionPathGalleryComponent,
	],
	template: `
		<!-- Preview: plays presentation from this slide; no element-only preview API yet -->
		<button
			type="button"
			class="pptx-rb-pill"
			[disabled]="!canAuthor()"
			[title]="'pptx.animations.previewTooltip' | translate"
			(click)="present.emit()"
		>
			<svg lucidePlay class="h-4 w-4"></svg> {{ 'pptx.animations.preview' | translate }}
		</button>
		<span class="pptx-rb-sep"></span>
		<!-- Preset gallery: the whole shared catalogue, one button per preset -->
		<pptx-ribbon-animation-gallery
			[disabled]="!canAuthor()"
			(addAnimation)="onGalleryPick($event)"
		/>
		<span class="pptx-rb-sep"></span>
		<!--
			Motion Paths: its own captioned group (a path is geometry that coexists
			with the preset buckets, not a fourth bucket of them), capped at React's
			own 420px. Uncapped, five 150px family columns claim ~800px of a
			single-row ribbon and squeeze the Advanced Animation pills beside them
			until their labels overlap.

			shrink-0, not shrink: this section used to opt INTO shrinking
			(shrink = flex-shrink: 1) with no min-width, and overflow-hidden
			removes the browser's automatic min-content-size floor a flex item
			would otherwise get. With the ribbon row tight on space (which is the
			normal case once Advanced Animation and Timing claim their own
			content-sized width), ALL of the row's required shrinkage landed on
			this one section, collapsing it to ~50px wide, i.e. hard-clipping four
			of the five families (Arcs/Turns/Shapes/Loops), reachable by neither
			scroll nor sight. pptx-ribbon-animations-section renders with
			display: contents (see its host below), so the ribbon row's own
			shrink-0-on-every-child safety net (ribbon.component.ts) never reaches
			this section either: that rule is a real CSS child combinator, so it
			lands on the custom element itself, not on the elements its
			display: contents template promotes up into the row's flex layout.
			Every element promoted that way needs its own shrink-0, the same fix
			already applied to the View tab's Eyedropper control (see the
			shrink-0-on-every-child comment in pptx-angular-viewer.css). shrink-0
			keeps this section at its own content width (capped at max-w-420px)
			and lets the row's own horizontal scroll handle any total overflow,
			same as every other group.
		-->
		<section
			class="relative flex max-w-[420px] shrink-0 items-start gap-1 overflow-hidden pb-3"
			[attr.aria-label]="'pptx.animation.motionPath' | translate"
		>
			<pptx-ribbon-motion-path-gallery
				[disabled]="!canAuthor()"
				(applyMotionPath)="applyMotionPath($event)"
			/>
			<span
				class="pointer-events-none absolute inset-x-1 bottom-0 truncate text-center text-[9px] leading-3 text-muted-foreground"
			>
				{{ 'pptx.animation.motionPath' | translate }}
			</span>
		</section>
		<span class="pptx-rb-sep"></span>
		<!-- Advanced Animation -->
		<button
			type="button"
			class="pptx-rb-pill"
			[disabled]="!canAuthor()"
			(click)="addAnimation('fadeOut', 'exit')"
		>
			<svg lucideStar class="h-4 w-4 text-red-500"></svg>
			{{ 'pptx.animations.exitEffects' | translate }}
		</button>
		<!--
			One-click default path (Lines: Right). It used to apply a Fly In
			entrance, which is not a path at all.
		-->
		<button
			type="button"
			class="pptx-rb-pill"
			[disabled]="!canAuthor()"
			(click)="applyMotionPath(defaultMotionPathPresetId)"
		>
			<svg lucideMoveRight class="h-4 w-4"></svg>
			{{ 'pptx.animations.pathAnimation' | translate }}
		</button>
		<button
			type="button"
			class="pptx-rb-pill"
			[disabled]="!canAuthor()"
			(click)="toggleInspector.emit()"
		>
			<svg lucideSparkles class="h-4 w-4"></svg>
			{{ 'pptx.animations.effectOptions' | translate }}
		</button>
		<button
			type="button"
			class="pptx-rb-pill"
			[disabled]="!canAuthor()"
			(click)="toggleInspector.emit()"
		>
			<svg lucideMousePointerClick class="h-4 w-4"></svg>
			{{ 'pptx.animations.trigger' | translate }}
		</button>
		<!-- Animation Painter: no cross-element animation copy API yet. -->
		<button type="button" class="pptx-rb-pill" disabled>
			<svg lucidePaintbrush class="h-4 w-4"></svg>
			{{ 'pptx.animations.painter' | translate }}
		</button>
		<button
			type="button"
			class="pptx-rb-pill"
			[disabled]="!canAuthor()"
			[title]="'pptx.animations.removeTooltip' | translate"
			(click)="removeAnim()"
		>
			<svg lucideTrash2 class="h-4 w-4"></svg> {{ 'pptx.animations.remove' | translate }}
		</button>
		<span class="pptx-rb-sep"></span>
		<!-- Animation Panel -->
		<button
			type="button"
			class="pptx-rb-pill"
			[title]="'pptx.animations.openPanelTooltip' | translate"
			(click)="toggleInspector.emit()"
		>
			<svg lucidePanelRight class="h-4 w-4"></svg>
			{{ 'pptx.animations.animationPanel' | translate }}
		</button>
		<span class="pptx-rb-sep"></span>
		<!--
			Timing: start mode and duration are authored in the Animation Panel; these
			read-only stand-ins mirror PowerPoint's Timing group so the tab reads the
			same across bindings. Both fields are disabled until the Animation Panel
			can author them.
		-->
		<div class="grid grid-cols-[auto_5.5rem] items-center gap-x-1 gap-y-1 text-[10px]">
			<label for="pptx-animation-start">{{ 'pptx.animations.start' | translate }}</label>
			<select id="pptx-animation-start" class="pptx-rb-select h-6" disabled>
				<option>{{ 'pptx.animations.onClick' | translate }}</option>
				<option>{{ 'pptx.animations.withPrevious' | translate }}</option>
				<option>{{ 'pptx.animations.afterPrevious' | translate }}</option>
			</select>
			<span class="flex items-center gap-1">
				<svg lucideClock3 class="h-3 w-3"></svg>
				{{ 'pptx.animations.duration' | translate }}
			</span>
			<input
				type="number"
				min="0"
				step="0.1"
				value="0.5"
				class="pptx-rb-select h-6"
				[attr.aria-label]="'pptx.animations.duration' | translate"
				disabled
			/>
		</div>
	`,
})
export class RibbonAnimationsSectionComponent {
	private readonly editor = inject(EditorStateService);

	readonly slideIndex = input<number>(0);
	readonly selectedElement = input<PptxElement | null>(null);
	readonly canEdit = input<boolean>(false);

	readonly present = output<void>();
	readonly toggleInspector = output<void>();

	protected hasSel(): boolean {
		return this.editor.selectedIds().length > 0;
	}

	protected canAuthor(): boolean {
		return canAuthorAnimation(this.canEdit(), this.hasSel());
	}

	/** The path the one-click "Path Animation" command applies. */
	protected readonly defaultMotionPathPresetId = DEFAULT_MOTION_PATH_PRESET_ID;

	/** Apply the preset a gallery button asked for. */
	protected onGalleryPick(pick: AnimationPresetPick): void {
		this.addAnimation(pick.preset, pick.group);
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
		if (!this.canEdit()) {
			return;
		}
		const el = this.selectedElement();
		if (!el) {
			return;
		}
		const slide = this.editor.slides()[this.slideIndex()];
		if (!slide) {
			return;
		}
		const updated = applyMotionPathPreset(slide.animations ?? [], el.id, presetId);
		this.editor.updateSlide(this.slideIndex(), { animations: updated } as Partial<PptxSlide>);
	}

	/**
	 * Add an animation preset to the selected element on the active slide.
	 * Delegates to the immutable helpers in animation-author-helpers.ts and
	 * commits the updated animations array via EditorStateService.updateSlide.
	 */
	protected addAnimation(preset: PptxAnimationPreset, group: AnimationGroup): void {
		if (!this.canEdit()) {
			return;
		}
		const el = this.selectedElement();
		if (!el) {
			return;
		}
		const slide = this.editor.slides()[this.slideIndex()];
		if (!slide) {
			return;
		}
		const current = slide.animations ?? [];
		let updated: ReturnType<typeof setAnimationEntrance>;
		if (group === 'entrance') {
			updated = setAnimationEntrance(current, el.id, preset);
		} else if (group === 'emphasis') {
			updated = setAnimationEmphasis(current, el.id, preset);
		} else {
			updated = setAnimationExit(current, el.id, preset);
		}
		this.editor.updateSlide(this.slideIndex(), { animations: updated } as Partial<PptxSlide>);
	}

	/** Remove all animations from the selected element. */
	protected removeAnim(): void {
		if (!this.canEdit()) {
			return;
		}
		const el = this.selectedElement();
		if (!el) {
			return;
		}
		const slide = this.editor.slides()[this.slideIndex()];
		if (!slide) {
			return;
		}
		const updated = removeAnimation(slide.animations ?? [], el.id);
		this.editor.updateSlide(this.slideIndex(), { animations: updated } as Partial<PptxSlide>);
	}
}

/**
 * ribbon-transitions-section.component.ts: the Transitions ribbon tab (preview,
 * preset gallery, duration, sound, Apply to all, Advance Slide, Inspector).
 *
 * Every control on this tab now commits through the ONE shared decision module
 * (`render/ribbon-transitions`): the tab holds a single
 * {@link RibbonTransitionDraft}, seeded from the active slide by
 * `readRibbonTransitionDraft`, and each change re-commits the whole draft with
 * `applyRibbonTransitionDraft`. Before that, the Advance Slide checkboxes and
 * the seconds field wrote component-local signals nothing ever read, so a timed
 * advance picked here never reached the deck (and never reached the saved
 * `.pptx`), while the preset/duration commits hard-coded `advanceOnClick: true`
 * and dropped whatever else the slide's `p:transition` carried.
 *
 * The draft is re-seeded whenever the active slide changes, so the tab reports
 * the slide it is looking at rather than the last preset the user clicked.
 */
import { NgClass } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	ElementRef,
	inject,
	input,
	output,
	signal,
	viewChild,
} from '@angular/core';
import { LucidePanelRight, LucidePlay } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxSlideTransition, PptxTransitionType } from 'pptx-viewer-core';

import type { RibbonTransitionDraft } from '../internal/shared';
import {
	applyRibbonTransitionDraft,
	applyTransitionSoundFile,
	clearTransitionSound,
	mergeSlideTransition,
	playSlideTransitionPreview,
	readRibbonTransitionDraft,
	readSoundFileAsDataUrl,
	RIBBON_TRANSITION_PRESETS,
	ribbonTransitionTargets,
	TRANSITION_SOUND_NONE_VALUE,
	TRANSITION_SOUND_OTHER_VALUE,
	transitionSoundOptions,
	transitionSoundSelectedValue,
} from '../internal/shared';
import { EditorStateService } from './editor-state.service';

@Component({
	selector: 'pptx-ribbon-transitions-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [NgClass, TranslatePipe, LucidePlay, LucidePanelRight],
	template: `
		<!--
			Preview REPLAYS the transition on the editing stage (shared
			playSlideTransitionPreview) and writes nothing. It used to emit "present",
			i.e. it started the whole slide show: a different action under the same
			name, in one binding out of five.
		-->
		<button
			type="button"
			class="pptx-rb-pill"
			[title]="'pptx.ribbon.previewTransition' | translate"
			(click)="preview()"
		>
			<svg lucidePlay class="h-4 w-4"></svg> {{ 'pptx.ribbon.preview' | translate }}
		</button>
		<span class="pptx-rb-sep"></span>
		<!-- Preset gallery -->
		<div class="inline-flex max-w-[420px] items-center gap-0.5 overflow-x-auto">
			@for (t of transitionPresets; track t.type) {
				<button
					type="button"
					(click)="setTransition(t.type)"
					class="flex-shrink-0 rounded border px-2 py-1 text-[11px] leading-tight transition-colors"
					[ngClass]="
						draft().type === t.type
							? 'border-primary bg-primary/10 font-medium text-primary'
							: 'border-border bg-muted text-foreground hover:bg-accent'
					"
					[title]="'pptx.ribbon.transitionTitle' | translate: { name: t.labelKey | translate }"
				>
					{{ t.labelKey | translate }}
				</button>
			}
		</div>
		<span class="pptx-rb-sep"></span>
		<!-- Duration -->
		<label class="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
			<span class="whitespace-nowrap">{{ 'pptx.ribbon.duration' | translate }}</span>
			<input
				type="number"
				min="0"
				max="10"
				step="0.1"
				[value]="draft().durationSec"
				(change)="onDurationChange($event)"
				class="pptx-rb-select w-16 text-center"
				[title]="'pptx.ribbon.transitionDurationTitle' | translate"
			/>
			<span>s</span>
		</label>
		<span class="pptx-rb-sep"></span>
		<!--
			Sound. "Other Sound..." opens a native file picker and the chosen file
			is embedded into the package on save (core's embedTransitionSound).
			"None" clears any sound the slide carries.
		-->
		<label class="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
			<span class="whitespace-nowrap">{{ 'pptx.ribbon.sound' | translate }}</span>
			<select
				[attr.aria-label]="'pptx.ribbon.sound' | translate"
				class="pptx-rb-select w-24 disabled:opacity-50"
				[value]="soundSelectedValue()"
				(change)="onSoundSelectChange($event)"
			>
				@for (option of soundOptions(); track option.value) {
					<option [value]="option.value">
						{{ option.i18nKey ? (option.i18nKey | translate) : option.label }}
					</option>
				}
			</select>
			<input
				#soundFileInput
				type="file"
				accept="audio/*"
				class="hidden"
				(change)="onSoundFileChange($event)"
			/>
		</label>
		<span class="pptx-rb-sep"></span>
		<!-- Apply to all -->
		<button
			type="button"
			class="pptx-rb-pill"
			[title]="'pptx.ribbon.applyTransitionToAll' | translate"
			[attr.aria-label]="'pptx.headerFooter.applyToAll' | translate"
			(click)="applyToAll()"
		>
			<span aria-hidden="true">⧉</span> {{ 'pptx.headerFooter.applyToAll' | translate }}
		</button>
		<span class="pptx-rb-sep"></span>
		<!-- Advance Slide -->
		<div class="inline-flex flex-col gap-1 text-xs text-muted-foreground">
			<span class="text-[10px] font-medium text-foreground">{{
				'pptx.ribbon.advanceSlide' | translate
			}}</span>
			<label class="inline-flex cursor-pointer items-center gap-1.5">
				<input
					type="checkbox"
					[checked]="draft().advanceOnClick"
					(change)="onAdvanceOnClick($event)"
					class="accent-primary h-3 w-3"
				/>
				<span class="whitespace-nowrap">{{ 'pptx.ribbon.onMouseClick' | translate }}</span>
			</label>
			<!--
				Two controls under one label element: a label names only its FIRST
				labelable descendant, so without these the seconds field had an EMPTY
				accessible name and the checkbox took the field's value into its own
				("After 5 seconds"). Both are named explicitly instead.
			-->
			<label class="inline-flex cursor-pointer items-center gap-1.5">
				<input
					type="checkbox"
					[attr.aria-label]="'pptx.ribbon.afterDuration' | translate"
					[checked]="draft().advanceAfter"
					(change)="onAdvanceAfter($event)"
					class="accent-primary h-3 w-3"
				/>
				<span class="whitespace-nowrap">{{ 'pptx.ribbon.afterDuration' | translate }}</span>
				<input
					type="text"
					[attr.aria-label]="'pptx.ribbon.advanceAfterSeconds' | translate"
					[value]="draft().advanceAfterText"
					(change)="onAdvanceAfterText($event)"
					[disabled]="!draft().advanceAfter"
					class="pptx-rb-select w-16 text-center disabled:opacity-50"
					[title]="'pptx.ribbon.advanceAfterSeconds' | translate"
				/>
			</label>
		</div>
		<span class="pptx-rb-sep"></span>
		<!-- Inspector -->
		<button
			type="button"
			class="pptx-rb-pill"
			[title]="'pptx.ribbon.openInspectorTransitions' | translate"
			(click)="toggleInspector.emit()"
		>
			<svg lucidePanelRight class="h-4 w-4"></svg> {{ 'pptx.ribbon.inspector' | translate }}
		</button>
	`,
})
export class RibbonTransitionsSectionComponent {
	private readonly editor = inject(EditorStateService);

	readonly slideIndex = input<number>(0);

	readonly toggleInspector = output<void>();

	protected readonly transitionPresets = RIBBON_TRANSITION_PRESETS;

	/**
	 * The draft the user is editing, tagged with the slide it belongs to. Null
	 * until a control is touched, and abandoned as soon as the active slide
	 * changes, which is what makes the tab re-read the new slide.
	 */
	private readonly edited = signal<{ index: number; draft: RibbonTransitionDraft } | null>(null);

	/**
	 * What the tab's controls say: the live draft for THIS slide, otherwise the
	 * slide's own transition read back through shared. Keeping the untouched
	 * case derived from the deck is what stops the tab reporting the last preset
	 * the user clicked after they navigate away.
	 */
	protected readonly draft = computed<RibbonTransitionDraft>(() => {
		const index = this.slideIndex();
		const slides = this.editor.slides();
		const edit = this.edited();
		if (edit && edit.index === index) {
			return edit.draft;
		}
		// `readRibbonTransitionDraft` answers EMPTY_RIBBON_TRANSITION_DRAFT for a
		// missing slide, so an empty deck needs no special case here.
		return readRibbonTransitionDraft(slides[index]);
	});

	/** Replay the active slide's transition on the stage. Never writes. */
	protected preview(): void {
		playSlideTransitionPreview(this.editor.slides()[this.slideIndex()]?.transition, document);
	}

	/** Apply the chosen preset to the active slide. */
	protected setTransition(type: PptxTransitionType): void {
		this.commit({ type });
	}

	protected onDurationChange(event: Event): void {
		const durationSec = Number((event.target as HTMLInputElement).value);
		if (Number.isFinite(durationSec) && durationSec >= 0) {
			this.commit({ durationSec });
		}
	}

	protected onAdvanceOnClick(event: Event): void {
		this.commit({ advanceOnClick: (event.target as HTMLInputElement).checked });
	}

	protected onAdvanceAfter(event: Event): void {
		this.commit({ advanceAfter: (event.target as HTMLInputElement).checked });
	}

	protected onAdvanceAfterText(event: Event): void {
		this.commit({ advanceAfterText: (event.target as HTMLInputElement).value });
	}

	/** Apply the current draft to every slide in the deck. */
	protected applyToAll(): void {
		this.commit({}, true);
	}

	private readonly soundFileInput = viewChild<ElementRef<HTMLInputElement>>('soundFileInput');

	/** What the Sound `<select>` shows: the picked file's name, None, or the browse entry. */
	protected readonly soundOptions = computed(() =>
		transitionSoundOptions(this.editor.slides()[this.slideIndex()]?.transition),
	);

	protected readonly soundSelectedValue = computed(() =>
		transitionSoundSelectedValue(this.editor.slides()[this.slideIndex()]?.transition),
	);

	/**
	 * Sound writes a raw `Partial<PptxSlideTransition>` straight onto the
	 * active slide rather than going through the ribbon draft: the picked
	 * file's `soundData` has no equivalent in {@link RibbonTransitionDraft},
	 * and `updateSlide` replaces `transition` wholesale, so the change is
	 * pre-merged with `mergeSlideTransition`.
	 */
	protected onSoundSelectChange(event: Event): void {
		const select = event.target as HTMLSelectElement;
		if (select.value === TRANSITION_SOUND_OTHER_VALUE) {
			this.soundFileInput()?.nativeElement.click();
			// The file input's own change (or a cancelled dialog) decides what
			// happens next; put the select back to what the slide actually has.
			select.value = this.soundSelectedValue();
			return;
		}
		if (select.value === TRANSITION_SOUND_NONE_VALUE) {
			this.commitSoundChange(clearTransitionSound());
		}
	}

	protected onSoundFileChange(event: Event): void {
		const fileInput = event.target as HTMLInputElement;
		const file = fileInput.files?.[0];
		fileInput.value = '';
		if (!file) {
			return;
		}
		void readSoundFileAsDataUrl(file).then((dataUrl) => {
			if (dataUrl) {
				this.commitSoundChange(applyTransitionSoundFile({ name: file.name, dataUrl }));
			}
			return undefined;
		});
	}

	private commitSoundChange(changes: Partial<PptxSlideTransition>): void {
		const index = this.slideIndex();
		const slide = this.editor.slides()[index];
		if (!slide) {
			return;
		}
		this.editor.updateSlide(index, { transition: mergeSlideTransition(slide.transition, changes) });
	}

	/**
	 * Merge a control's change into the draft and write the resulting transition
	 * onto every targeted slide, preserving each slide's own direction / spokes /
	 * sound / raw XML through the shared merge.
	 */
	private commit(patch: Partial<RibbonTransitionDraft>, applyToAll = false): void {
		const index = this.slideIndex();
		const next: RibbonTransitionDraft = { ...this.draft(), ...patch };
		this.edited.set({ index, draft: next });
		const slides = this.editor.slides();
		for (const target of ribbonTransitionTargets(slides.length, index, applyToAll)) {
			this.editor.updateSlide(target, {
				transition: applyRibbonTransitionDraft(slides[target], next),
			});
		}
	}
}

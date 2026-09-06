/**
 * effect-sound-row.component.ts: the animation panel's effect sound row.
 *
 * PowerPoint's own gallery of 19 built-in stock sounds, "No Sound", and
 * "Other Sound..." (a custom audio file picked from disk), plus a Preview
 * button for the currently-selected stock sound.
 *
 * Selector: `pptx-effect-sound-row`
 *
 * Its own component for the same reason as {@link MotionPathRowComponent}:
 * keeps {@link AnimationAuthorPanelComponent} under this repo's 300-LOC cap.
 *
 * Reference binding: packages/react/src/viewer/components/inspector/EffectSoundRow.tsx
 *
 * @module viewer/effect-sound-row
 */
import {
	ChangeDetectionStrategy,
	Component,
	ElementRef,
	input,
	output,
	viewChild,
} from '@angular/core';
import { LucidePlay } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';

import { EFFECT_SOUND_CATALOGUE, getEffectSoundAsset } from '../internal/shared';
import type { EffectSoundState } from '../internal/shared';
import { playAnimationSound } from './animation-sound';

const NONE_VALUE = 'none';
const CURRENT_VALUE = 'current';
const OTHER_VALUE = 'other';

/** A newly-picked sound file, staged for embedding on the next save. */
export interface EffectSoundPick {
	dataUrl: string;
	fileName?: string;
}

@Component({
	selector: 'pptx-effect-sound-row',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe, LucidePlay],
	template: `
		<label class="pptx-ng-anim__section pptx-ng-effect-sound">
			<span class="pptx-ng-anim__label">{{ 'pptx.animation.sound' | translate }}</span>
			<div class="pptx-ng-effect-sound__row">
				<select
					[attr.aria-label]="'pptx.animation.sound' | translate"
					class="pptx-ng-anim__select"
					[disabled]="!canEdit()"
					(change)="onSelect($event)"
				>
					<option [value]="NONE_VALUE" [selected]="selectedValue() === NONE_VALUE">
						{{ 'pptx.animation.sound.none' | translate }}
					</option>
					@if (soundState().hasSound && !soundState().catalogueId) {
						<option [value]="CURRENT_VALUE" [selected]="selectedValue() === CURRENT_VALUE">
							{{ soundState().fileName ?? ('pptx.animation.sound.custom' | translate) }}
						</option>
					}
					@for (entry of catalogue; track entry.id) {
						<option [value]="entry.id" [selected]="selectedValue() === entry.id">
							{{ entry.i18nKey | translate }}
						</option>
					}
					<option [value]="OTHER_VALUE" [selected]="selectedValue() === OTHER_VALUE">
						{{ 'pptx.animation.sound.other' | translate }}
					</option>
				</select>
				<button
					type="button"
					class="pptx-ng-effect-sound__preview"
					[attr.aria-label]="'pptx.animation.sound.preview' | translate"
					[disabled]="!soundState().catalogueId"
					(click)="onPreview()"
				>
					<svg lucidePlay class="h-3 w-3"></svg>
				</button>
			</div>
			<input
				#fileInput
				type="file"
				accept="audio/*"
				[attr.aria-label]="'pptx.animation.sound.chooseFile' | translate"
				class="pptx-ng-effect-sound__file-input"
				tabindex="-1"
				(change)="onFileChange($event)"
			/>
		</label>
	`,
	styles: `
		.pptx-ng-effect-sound__file-input {
			display: none;
		}
		.pptx-ng-effect-sound__row {
			display: flex;
			align-items: center;
			gap: 4px;
		}
		.pptx-ng-effect-sound__preview:disabled {
			opacity: 0.4;
		}
	`,
})
export class EffectSoundRowComponent {
	readonly soundState = input.required<EffectSoundState>();
	readonly canEdit = input<boolean>(true);
	readonly pick = output<EffectSoundPick | undefined>();
	readonly pickStock = output<string>();

	protected readonly NONE_VALUE = NONE_VALUE;
	protected readonly CURRENT_VALUE = CURRENT_VALUE;
	protected readonly OTHER_VALUE = OTHER_VALUE;
	protected readonly catalogue = EFFECT_SOUND_CATALOGUE;

	private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

	protected selectedValue(): string {
		const state = this.soundState();
		return state.catalogueId ?? (state.hasSound ? CURRENT_VALUE : NONE_VALUE);
	}

	protected onSelect(event: Event): void {
		const target = event.target;
		if (!(target instanceof HTMLSelectElement)) {
			return;
		}
		const value = target.value;
		if (value === OTHER_VALUE) {
			this.fileInput()?.nativeElement.click();
			return;
		}
		if (value === NONE_VALUE) {
			this.pick.emit(undefined);
			return;
		}
		if (value === CURRENT_VALUE) {
			return;
		}
		this.pickStock.emit(value);
	}

	protected onFileChange(event: Event): void {
		const target = event.target;
		if (!(target instanceof HTMLInputElement)) {
			return;
		}
		const file = target.files?.[0];
		target.value = '';
		if (!file) {
			return;
		}
		const reader = new FileReader();
		reader.onload = () => {
			if (typeof reader.result === 'string') {
				this.pick.emit({ dataUrl: reader.result, fileName: file.name });
			}
		};
		reader.readAsDataURL(file);
	}

	protected onPreview(): void {
		const catalogueId = this.soundState().catalogueId;
		if (!catalogueId) {
			return;
		}
		const asset = getEffectSoundAsset(catalogueId);
		if (asset) {
			playAnimationSound(asset.dataUrl);
		}
	}
}

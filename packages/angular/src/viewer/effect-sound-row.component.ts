/**
 * effect-sound-row.component.ts: the animation panel's effect sound row
 * (`p:stSnd`): "No Sound" or a custom audio file picked from disk.
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
import { TranslatePipe } from '@ngx-translate/core';

import type { EffectSoundState } from '../internal/shared';

/** A newly-picked sound file, staged for embedding on the next save. */
export interface EffectSoundPick {
	dataUrl: string;
	fileName?: string;
}

@Component({
	selector: 'pptx-effect-sound-row',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		<label class="pptx-ng-anim__section pptx-ng-effect-sound">
			<span class="pptx-ng-anim__label">{{ 'pptx.animation.sound' | translate }}</span>
			<select
				[attr.aria-label]="'pptx.animation.sound' | translate"
				class="pptx-ng-anim__select"
				[disabled]="!canEdit()"
				(change)="onSelect($event)"
			>
				<option value="none" [selected]="!soundState().hasSound">
					{{ 'pptx.animation.sound.none' | translate }}
				</option>
				<option value="custom" [selected]="soundState().hasSound">
					{{
						soundState().hasSound && soundState().fileName
							? soundState().fileName
							: ('pptx.animation.sound.custom' | translate)
					}}
				</option>
			</select>
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
	`,
})
export class EffectSoundRowComponent {
	readonly soundState = input.required<EffectSoundState>();
	readonly canEdit = input<boolean>(true);
	readonly pick = output<EffectSoundPick | undefined>();

	private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

	protected onSelect(event: Event): void {
		const target = event.target;
		if (!(target instanceof HTMLSelectElement)) {
			return;
		}
		if (target.value === 'custom') {
			this.fileInput()?.nativeElement.click();
			return;
		}
		this.pick.emit(undefined);
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
}

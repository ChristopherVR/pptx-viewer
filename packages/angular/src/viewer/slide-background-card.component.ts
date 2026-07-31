/**
 * slide-background-card.component.ts: the BACKGROUND card of the default
 * (no-selection) inspector, mirroring React's `inspector/SlideBackgroundPanel`.
 *
 * Selector: `pptx-slide-background-card`
 *
 * Offers the three things a slide background can be: a solid colour, a picture
 * (read as a data URL so it survives save without a media round-trip), and
 * "none". Clearing wipes colour, image AND gradient together, because leaving
 * one of the three behind is how a "cleared" background silently keeps
 * rendering.
 *
 * @module viewer/slide-background-card
 */
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxSlide } from 'pptx-viewer-core';

import { normalizeHexColor } from '../internal/shared';
import { EditorStateService } from './editor-state.service';
import { INSPECTOR_CARD_STYLES } from './inspector-card-styles';

/** Image types accepted for a slide background picture. */
const BACKGROUND_IMAGE_ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,image/svg+xml';

@Component({
	selector: 'pptx-slide-background-card',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		@if (slide(); as sl) {
			<section class="icard" [attr.data-slide-key]="slideKey()">
				<h3 class="icard__heading">{{ 'pptx.viewer.background' | translate }}</h3>

				<label class="icard__row">
					<span class="icard__label">{{ 'pptx.slideBackground.colour' | translate }}</span>
					<input
						type="color"
						class="bg__color"
						[disabled]="!canEdit()"
						[attr.aria-label]="'pptx.slideBackground.colourAriaLabel' | translate"
						[value]="backgroundColor()"
						(change)="onColorChange($event)"
					/>
					<span class="icard__value">{{ sl.backgroundColor || 'none' }}</span>
				</label>

				<div class="icard__row">
					<span class="icard__label">{{ 'pptx.slideBackground.image' | translate }}</span>
					<input
						#imageInput
						type="file"
						class="bg__file"
						[accept]="imageAccept"
						[disabled]="!canEdit()"
						[attr.aria-label]="'pptx.slideBackground.chooseImage' | translate"
						(change)="onImagePicked($event)"
					/>
					<button
						type="button"
						class="icard__btn"
						[disabled]="!canEdit()"
						(click)="imageInput.click()"
					>
						{{
							(sl.backgroundImage
								? 'pptx.slideBackground.replaceImage'
								: 'pptx.slideBackground.chooseImage'
							) | translate
						}}
					</button>
				</div>

				@if (sl.backgroundImage; as image) {
					<div class="bg__preview">
						<img [src]="image" [alt]="'pptx.slideBackground.backgroundPreview' | translate" />
						<button
							type="button"
							class="bg__remove"
							[disabled]="!canEdit()"
							[title]="'pptx.slideBackground.removeBackgroundImage' | translate"
							[attr.aria-label]="'pptx.slideBackground.removeBackgroundImage' | translate"
							(click)="onRemoveImage()"
						>
							&times;
						</button>
					</div>
				}

				@if (hasBackground()) {
					<button
						type="button"
						class="icard__btn icard__btn--danger"
						[disabled]="!canEdit()"
						(click)="onClear()"
					>
						{{ 'pptx.slideBackground.clearBackground' | translate }}
					</button>
				}
			</section>
		}
	`,
	styles: [
		`
			:host {
				display: block;
			}
			.bg__color {
				width: 32px;
				height: 22px;
				padding: 1px;
				border: 1px solid var(--pptx-inspector-border, #444);
				border-radius: 3px;
				background: transparent;
				cursor: pointer;
			}
			/*
			 * The native file input is driven by the styled button next to it, so
			 * it is visually hidden rather than removed: a display:none input can
			 * still be clicked programmatically, and keeping it in the accessibility
			 * tree preserves keyboard access to the file picker.
			 */
			.bg__file {
				position: absolute;
				width: 1px;
				height: 1px;
				overflow: hidden;
				clip: rect(0 0 0 0);
				white-space: nowrap;
			}
			.bg__preview {
				position: relative;
			}
			.bg__preview img {
				display: block;
				width: 100%;
				height: 64px;
				object-fit: cover;
				border: 1px solid var(--pptx-inspector-border, #444);
				border-radius: 3px;
			}
			.bg__remove {
				position: absolute;
				top: 2px;
				right: 2px;
				width: 18px;
				height: 18px;
				padding: 0;
				border: 1px solid var(--pptx-inspector-border, #444);
				border-radius: 3px;
				background: var(--pptx-inspector-input-bg, rgba(0, 0, 0, 0.06));
				color: var(--pptx-inspector-danger, #d24d4d);
				line-height: 1;
				cursor: pointer;
			}
		`,
		INSPECTOR_CARD_STYLES,
	],
})
export class SlideBackgroundCardComponent {
	/** Zero-based index of the slide whose background is being edited. */
	readonly slideIndex = input.required<number>();
	/** Whether mutation controls are enabled. */
	readonly canEdit = input<boolean>(true);

	private readonly editor = inject(EditorStateService);

	protected readonly imageAccept = BACKGROUND_IMAGE_ACCEPT;

	protected readonly slide = computed<PptxSlide | undefined>(
		() => this.editor.slides()[this.slideIndex()],
	);

	/** Stable per-slide key so the colour input reseeds only on slide change. */
	protected readonly slideKey = computed(() => `slide-${this.slideIndex()}`);

	protected readonly backgroundColor = computed(() =>
		normalizeHexColor(this.slide()?.backgroundColor, '#ffffff'),
	);

	protected readonly hasBackground = computed(() => {
		const sl = this.slide();
		return Boolean(sl?.backgroundColor || sl?.backgroundImage || sl?.backgroundGradient);
	});

	protected onColorChange(event: Event): void {
		this.patch({ backgroundColor: (event.target as HTMLInputElement).value });
	}

	protected onImagePicked(event: Event): void {
		const picker = event.target as HTMLInputElement;
		const file = picker.files?.[0];
		if (!file) {
			return;
		}
		const reader = new FileReader();
		reader.onload = () => {
			if (typeof reader.result === 'string') {
				this.patch({ backgroundImage: reader.result });
			}
		};
		reader.readAsDataURL(file);
		// Clear the control so re-picking the SAME file still fires `change`.
		picker.value = '';
	}

	protected onRemoveImage(): void {
		this.patch({ backgroundImage: undefined });
	}

	protected onClear(): void {
		this.patch({
			backgroundColor: undefined,
			backgroundImage: undefined,
			backgroundGradient: undefined,
		});
	}

	private patch(changes: Partial<PptxSlide>): void {
		this.editor.updateSlide(this.slideIndex(), changes);
	}
}

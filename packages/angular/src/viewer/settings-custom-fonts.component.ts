import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { CUSTOM_FONT_ACCEPT, registerCustomFont } from '../internal/shared-src/render/custom-fonts';

/**
 * File > Options > General > Fonts. Angular port of React's
 * `SettingsCustomFontsSection.tsx`.
 *
 * Lets the user hand a local font file to the viewer so a deck authored with a
 * font the browser lacks renders with the real face instead of a substitute.
 * Opt-in, and deliberately session-scoped: the file is added to the page's
 * font set and nothing is uploaded or written into the presentation.
 */
@Component({
	selector: 'pptx-settings-custom-fonts',
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe],
	template: `
		<div class="mt-2">
			<button
				type="button"
				class="pptx-ng-options-btn"
				[disabled]="!enabled()"
				(click)="fileInput.click()"
			>
				{{ 'pptx.options.general.addFontFile' | translate }}
			</button>
			<input #fileInput type="file" class="hidden" [accept]="accept" (change)="onChange($event)" />

			@if (!enabled()) {
				<p class="pptx-ng-options-note">
					{{ 'pptx.options.general.customFontsDisabled' | translate }}
				</p>
			}
			@if (failed()) {
				<p role="alert" class="pptx-ng-options-note text-destructive">
					{{ 'pptx.options.general.customFontError' | translate }}
				</p>
			}

			<p class="pptx-ng-options-note font-semibold uppercase">
				{{ 'pptx.options.general.customFontsAdded' | translate }}
			</p>
			@if (families().length === 0) {
				<p class="pptx-ng-options-note">
					{{ 'pptx.options.general.customFontsEmpty' | translate }}
				</p>
			} @else {
				<ul class="mt-1 flex flex-col gap-0.5">
					@for (family of families(); track family) {
						<li class="text-xs text-foreground" [style.font-family]="family">{{ family }}</li>
					}
				</ul>
			}
		</div>
	`,
})
export class SettingsCustomFontsComponent {
	/** Mirrors `general.enableCustomFontUpload`; the picker stays inert when off. */
	readonly enabled = input<boolean>(false);
	/** Families registered so far this session. */
	readonly families = input<readonly string[]>([]);

	/** Notifies the viewer so the Home tab font list picks the family up. */
	readonly registered = output<string>();

	protected readonly accept = CUSTOM_FONT_ACCEPT;
	protected readonly failed = signal(false);

	protected onChange(event: Event): void {
		const picker = event.target as HTMLInputElement;
		const file = picker.files?.[0];
		// Clear the value so re-picking the same file fires change again.
		picker.value = '';
		if (file) {
			void this.register(file);
		}
	}

	private async register(file: File): Promise<void> {
		this.failed.set(false);
		try {
			const registration = await registerCustomFont(file);
			if (registration) {
				this.registered.emit(registration.family);
			} else {
				// Either the environment has no FontFace support, or the filename
				// reduced to nothing usable once its style tokens were stripped.
				this.failed.set(true);
			}
		} catch {
			this.failed.set(true);
		}
	}
}

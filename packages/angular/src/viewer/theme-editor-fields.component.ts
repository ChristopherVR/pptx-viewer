import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxTheme, PptxThemeColorScheme, PptxThemeFontScheme } from 'pptx-viewer-core';

export interface CustomThemeEdit {
	colorScheme: PptxThemeColorScheme;
	fontScheme: PptxThemeFontScheme;
	name: string;
}

export function createCustomThemeEdit(
	colorScheme: PptxThemeColorScheme,
	majorFont: string,
	minorFont: string,
	name: string,
): CustomThemeEdit {
	return {
		colorScheme,
		fontScheme: { majorFont: { latin: majorFont }, minorFont: { latin: minorFont } },
		name,
	};
}

const DEFAULT_COLORS: PptxThemeColorScheme = {
	dk1: '#000000',
	lt1: '#FFFFFF',
	dk2: '#44546A',
	lt2: '#E7E6E6',
	accent1: '#4472C4',
	accent2: '#ED7D31',
	accent3: '#A5A5A5',
	accent4: '#FFC000',
	accent5: '#5B9BD5',
	accent6: '#70AD47',
	hlink: '#0563C1',
	folHlink: '#954F72',
};

@Component({
	selector: 'pptx-theme-editor-fields',
	standalone: true,
	imports: [TranslatePipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="editor">
			<label class="stack">
				<span>{{ 'pptx.themeEditor.themeName' | translate }}</span>
				<input type="text" [value]="name()" (input)="name.set(value($event))" />
			</label>
			<div class="colors">
				@for (slot of slots; track slot) {
					<label [title]="slot">
						<input type="color" [value]="color(slot)" (input)="setColor(slot, $event)" />
						<span>{{ slot }}</span>
					</label>
				}
			</div>
			<div class="fonts">
				<label class="stack">
					<span>{{ 'pptx.themeEditor.headingFont' | translate }}</span>
					<input type="text" [value]="majorFont()" (input)="majorFont.set(value($event))" />
				</label>
				<label class="stack">
					<span>{{ 'pptx.themeEditor.bodyFont' | translate }}</span>
					<input type="text" [value]="minorFont()" (input)="minorFont.set(value($event))" />
				</label>
			</div>
			<button type="button" class="apply" (click)="apply()">
				{{ 'pptx.themeEditor.applyToPresentation' | translate }}
			</button>
		</div>
	`,
	styles: `
		.editor {
			display: grid;
			gap: 10px;
		}
		.stack {
			display: grid;
			gap: 4px;
			color: var(--muted-foreground);
			font-size: 11px;
		}
		input[type='text'] {
			box-sizing: border-box;
			width: 100%;
			padding: 5px 7px;
			border: 1px solid var(--border);
			border-radius: 4px;
			background: var(--background);
			color: var(--foreground);
		}
		.colors {
			display: grid;
			grid-template-columns: repeat(4, 1fr);
			gap: 6px;
		}
		.colors label {
			display: flex;
			align-items: center;
			gap: 4px;
			overflow: hidden;
			color: var(--muted-foreground);
			font-size: 10px;
		}
		.colors input {
			width: 26px;
			height: 24px;
			padding: 0;
			border: 1px solid var(--border);
			border-radius: 3px;
			background: transparent;
		}
		.colors span {
			overflow: hidden;
			text-overflow: ellipsis;
		}
		.fonts {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 8px;
		}
		.apply {
			justify-self: end;
			padding: 6px 10px;
			border: 0;
			border-radius: 4px;
			background: var(--primary);
			color: var(--primary-foreground);
			cursor: pointer;
		}
	`,
})
export class ThemeEditorFieldsComponent {
	readonly theme = input<PptxTheme | undefined>();
	readonly applyTheme = output<CustomThemeEdit>();
	readonly slots = Object.keys(DEFAULT_COLORS) as Array<keyof PptxThemeColorScheme>;
	readonly colors = signal<PptxThemeColorScheme>({ ...DEFAULT_COLORS });
	readonly name = signal('Custom Theme');
	readonly majorFont = signal('Calibri Light');
	readonly minorFont = signal('Calibri');

	ngOnInit(): void {
		const theme = this.theme();
		this.colors.set({ ...DEFAULT_COLORS, ...(theme?.colorScheme ?? {}) });
		this.name.set(theme?.name ?? 'Custom Theme');
		this.majorFont.set(theme?.fontScheme?.majorFont?.latin ?? 'Calibri Light');
		this.minorFont.set(theme?.fontScheme?.minorFont?.latin ?? 'Calibri');
	}

	protected value(event: Event): string {
		return (event.target as HTMLInputElement).value;
	}

	protected color(slot: keyof PptxThemeColorScheme): string {
		const raw = String(this.colors()[slot] ?? '#000000');
		const hex = raw.startsWith('#') ? raw : `#${raw}`;
		return /^#[\da-f]{6}$/iu.test(hex) ? hex : '#000000';
	}

	protected setColor(slot: keyof PptxThemeColorScheme, event: Event): void {
		this.colors.update((colors) => ({ ...colors, [slot]: this.value(event) }));
	}

	protected apply(): void {
		this.applyTheme.emit(
			createCustomThemeEdit(this.colors(), this.majorFont(), this.minorFont(), this.name()),
		);
	}
}

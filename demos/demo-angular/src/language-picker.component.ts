import { NgStyle } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	HostListener,
	input,
	output,
	signal,
} from '@angular/core';

import { LANGUAGES } from './languages';
import { THEMES } from './themes';

/**
 * Floating language picker (Angular port of the React/Vue demos' `LanguagePicker`).
 *
 * Stacked directly above the theme picker (same fixed corner) rather than
 * beside it, so the two never collide regardless of how wide either button's
 * label happens to be.
 */
@Component({
	selector: 'app-language-picker',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle],
	template: `
		<div class="picker" [class.picker--small]="isSmallScreen()" [ngStyle]="containerStyle()">
			<button
				type="button"
				class="pill"
				title="Switch language"
				[ngStyle]="pillStyle()"
				(click)="toggle()"
			>
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<circle cx="12" cy="12" r="10" />
					<path d="M2 12h20" />
					<path
						d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"
					/>
				</svg>
				{{ label(current()) }}
			</button>
			@if (open()) {
				<div class="menu" [ngStyle]="menuStyle()">
					@for (language of languages; track language.code) {
						<button
							type="button"
							class="row"
							[ngStyle]="rowStyle(language.code)"
							(click)="choose(language.code)"
						>
							{{ language.label }}
						</button>
					}
				</div>
			}
		</div>
	`,
	styles: [
		`
			.picker {
				position: fixed;
				bottom: 92px;
				right: 12px;
				font-family: system-ui, sans-serif;
			}
			.picker--small {
				bottom: auto;
				right: 8px;
				top: calc(env(safe-area-inset-top, 0px) + 104px);
			}
			.pill {
				display: flex;
				align-items: center;
				gap: 6px;
				padding: 6px 12px;
				border-radius: 9999px;
				cursor: pointer;
				font-size: 13px;
				font-weight: 500;
				box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
			}
			.menu {
				position: absolute;
				bottom: 100%;
				margin-bottom: 4px;
				right: 0;
				border-radius: 8px;
				overflow-y: auto;
				max-height: 60dvh;
				box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
				min-width: 150px;
			}
			.picker--small .menu {
				bottom: auto;
				margin-bottom: 0;
				top: 100%;
				margin-top: 4px;
			}
			.row {
				display: flex;
				align-items: center;
				width: 100%;
				padding: 8px 14px;
				border: none;
				cursor: pointer;
				font-size: 13px;
				text-align: left;
			}
		`,
	],
})
export class LanguagePickerComponent {
	/** Active language code. */
	readonly current = input.required<string>();
	/** Active theme key, used to colour the picker to match the active theme. */
	readonly theme = input.required<string>();
	/** Emits the newly selected language code. */
	readonly languageChange = output<string>();

	protected readonly languages = LANGUAGES;
	protected readonly open = signal(false);
	private readonly isSmallScreenState = signal(
		typeof window !== 'undefined' && window.innerWidth < 768,
	);
	protected readonly isSmallScreen = computed(() => this.isSmallScreenState());

	private readonly preset = computed(() => THEMES[this.theme()] ?? THEMES['vermilionDark']);
	private readonly bg = computed(() => this.preset().theme.colors?.card ?? '#111827');
	private readonly border = computed(() => this.preset().theme.colors?.border ?? '#374151');
	private readonly fg = computed(() => this.preset().theme.colors?.mutedForeground ?? '#9ca3af');
	private readonly primary = computed(() => this.preset().theme.colors?.primary ?? '#6366f1');

	protected readonly containerStyle = computed<Record<string, string>>(() => ({
		zIndex: this.open() ? '100000' : '99999',
	}));

	protected readonly pillStyle = computed<Record<string, string>>(() => ({
		border: `1px solid ${this.border()}`,
		background: this.bg(),
		color: this.fg(),
	}));

	protected readonly menuStyle = computed<Record<string, string>>(() => ({
		background: this.bg(),
		border: `1px solid ${this.border()}`,
	}));

	@HostListener('window:resize')
	protected onResize(): void {
		this.isSmallScreenState.set(window.innerWidth < 768);
	}

	protected toggle(): void {
		this.open.update((v) => !v);
	}

	protected choose(code: string): void {
		this.languageChange.emit(code);
		this.open.set(false);
	}

	protected label(code: string): string {
		return (this.languages.find((language) => language.code === code) ?? this.languages[0]).label;
	}

	protected rowStyle(code: string): Record<string, string> {
		const isActive = code === this.current();
		return {
			background: isActive ? `${this.primary()}22` : 'transparent',
			color: isActive ? this.primary() : this.fg(),
			fontWeight: isActive ? '600' : '400',
		};
	}
}

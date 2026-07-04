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

import { THEME_KEYS, THEMES } from './themes';

/**
 * Floating theme picker (Angular port of the React demo's `ThemePicker`).
 *
 * A fixed-position pill button (bottom-right on desktop, top-right under the
 * safe-area on mobile <768px) showing a sun icon + the active theme label.
 * Clicking opens a menu listing every theme with a colour swatch dot and the
 * active row highlighted. It floats above the viewer via a high z-index.
 */
@Component({
	selector: 'app-theme-picker',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [NgStyle],
	template: `
		<div class="picker" [ngStyle]="containerStyle()">
			<button
				type="button"
				class="pill"
				title="Switch theme"
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
					<circle cx="12" cy="12" r="4" />
					<path d="M12 2v2" />
					<path d="M12 20v2" />
					<path d="m4.93 4.93 1.41 1.41" />
					<path d="m17.66 17.66 1.41 1.41" />
					<path d="M2 12h2" />
					<path d="M20 12h2" />
					<path d="m6.34 17.66-1.41 1.41" />
					<path d="m19.07 4.93-1.41 1.41" />
				</svg>
				{{ preset().label }}
			</button>
			@if (open()) {
				<div class="menu" [ngStyle]="menuStyle()">
					@for (key of themeKeys; track key) {
						<button type="button" class="row" [ngStyle]="rowStyle(key)" (click)="choose(key)">
							<span class="swatch" [ngStyle]="swatchStyle(key)"></span>
							{{ label(key) }}
						</button>
					}
				</div>
			}
		</div>
	`,
	styles: [
		`
			.picker {
				font-family: system-ui, sans-serif;
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
				right: 0;
				border-radius: 8px;
				overflow-y: auto;
				max-height: 60dvh;
				box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
				min-width: 150px;
			}
			.row {
				display: flex;
				align-items: center;
				gap: 8px;
				width: 100%;
				padding: 8px 14px;
				border: none;
				cursor: pointer;
				font-size: 13px;
				text-align: left;
			}
			.swatch {
				width: 14px;
				height: 14px;
				border-radius: 9999px;
				flex-shrink: 0;
			}
		`,
	],
})
export class ThemePickerComponent {
	/** Active theme key. */
	readonly current = input.required<string>();
	/** Emits the newly selected theme key. */
	readonly themeChange = output<string>();

	protected readonly themeKeys = THEME_KEYS;
	protected readonly open = signal(false);
	private readonly isSmallScreen = signal(typeof window !== 'undefined' && window.innerWidth < 768);

	@HostListener('window:resize')
	protected onResize(): void {
		this.isSmallScreen.set(window.innerWidth < 768);
	}

	protected readonly preset = computed(() => THEMES[this.current()] ?? THEMES['dark']);
	private readonly bg = computed(() => this.preset().theme.colors?.card ?? '#111827');
	private readonly border = computed(() => this.preset().theme.colors?.border ?? '#374151');
	private readonly fg = computed(() => this.preset().theme.colors?.mutedForeground ?? '#9ca3af');
	private readonly primary = computed(() => this.preset().theme.colors?.primary ?? '#6366f1');

	protected readonly containerStyle = computed<Record<string, string>>(() => ({
		position: 'fixed',
		zIndex: this.open() ? '100000' : '99999',
		...(this.isSmallScreen()
			? { top: 'calc(env(safe-area-inset-top, 0px) + 60px)', right: '8px' }
			: { bottom: '48px', right: '12px' }),
	}));

	protected readonly pillStyle = computed<Record<string, string>>(() => ({
		border: `1px solid ${this.border()}`,
		background: this.bg(),
		color: this.fg(),
	}));

	protected readonly menuStyle = computed<Record<string, string>>(() => ({
		background: this.bg(),
		border: `1px solid ${this.border()}`,
		...(this.isSmallScreen()
			? { top: '100%', marginTop: '4px' }
			: { bottom: '100%', marginBottom: '4px' }),
	}));

	protected toggle(): void {
		this.open.update((v) => !v);
	}

	protected choose(key: string): void {
		this.themeChange.emit(key);
		this.open.set(false);
	}

	protected label(key: string): string {
		return (THEMES[key] ?? THEMES['dark']).label;
	}

	protected rowStyle(key: string): Record<string, string> {
		const isActive = key === this.current();
		return {
			background: isActive ? `${this.primary()}22` : 'transparent',
			color: isActive ? this.primary() : this.fg(),
			fontWeight: isActive ? '600' : '400',
		};
	}

	protected swatchStyle(key: string): Record<string, string> {
		const colors = (THEMES[key] ?? THEMES['dark']).theme.colors;
		return {
			background: colors?.primary ?? '#6366f1',
			border: `2px solid ${colors?.border ?? '#374151'}`,
		};
	}
}

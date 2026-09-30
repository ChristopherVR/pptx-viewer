import {
	ChangeDetectionStrategy,
	Component,
	CUSTOM_ELEMENTS_SCHEMA,
	inject,
	input,
	output,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { THEME_COLOR_SCHEME_KEYS } from 'pptx-viewer-core';
import type { PptxTheme, PptxThemeColorScheme } from 'pptx-viewer-core';

import { themeEditorLabels } from '../internal/shared';
import type { ThemeEditorApplyEvent, ThemeEditorEdit } from '../internal/shared';

export type CustomThemeEdit = ThemeEditorEdit;
export { createCustomThemeEdit } from '../internal/shared';
export const THEME_EDITOR_COLOR_SLOTS: (keyof PptxThemeColorScheme)[] = [
	...THEME_COLOR_SCHEME_KEYS,
];

@Component({
	selector: 'pptx-theme-editor-fields',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	template: `<pptx-ui-theme-editor
		[theme]="theme()"
		[labels]="labels()"
		[disabled]="!canEdit()"
		[attr.inline]="inline() ? '' : null"
		(theme-editor-apply)="apply($event)"
		(theme-editor-close)="close.emit()"
	/>`,
})
export class ThemeEditorFieldsComponent {
	readonly theme = input<PptxTheme | undefined>();
	readonly canEdit = input(true);
	readonly inline = input(false);
	readonly applyTheme = output<CustomThemeEdit>();
	readonly close = output<void>();
	private readonly translate = inject(TranslateService);
	protected labels() {
		return themeEditorLabels((key) => this.translate.instant(key));
	}
	protected apply(event: Event): void {
		this.applyTheme.emit((event as ThemeEditorApplyEvent).detail);
	}
}

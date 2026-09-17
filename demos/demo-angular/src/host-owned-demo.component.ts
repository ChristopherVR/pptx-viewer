import {
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	inject,
	signal,
	viewChild,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { PowerPointViewerComponent, translationsEn } from 'pptx-angular-viewer';
import {
	translationsDe,
	translationsEs,
	translationsFr,
	translationsZhCN,
} from 'pptx-viewer-locales';

import { createHostOwnedDemo } from '../../shared/host-owned-collaboration';
import type { HostOwnedDemo } from '../../shared/host-owned-collaboration';
import { HostOwnedHeadlessEditorComponent } from './host-owned-headless-editor.component';

@Component({
	selector: 'app-root',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [PowerPointViewerComponent, HostOwnedHeadlessEditorComponent],
	template: `<main style="position: fixed" [style.inset]="headless ? '104px 0 0' : '64px 0 0'">
		@if (error()) {
			<p role="alert">{{ error() }}</p>
		}
		@if (host(); as session) {
			@if (mounted()) {
				@if (headless) {
					<app-host-owned-headless-editor [host]="session" />
				} @else {
					<pptx-viewer
						[content]="session.source"
						[fileName]="session.fileName"
						[collaboration]="session.config"
						[canEdit]="session.editable"
					/>
				}
			}
		}
	</main>`,
})
export class HostOwnedDemoComponent {
	readonly headless = new URLSearchParams(location.search).get('headless') === '1';
	readonly host = signal<HostOwnedDemo | null>(null);
	readonly mounted = signal(true);
	readonly error = signal('');
	private readonly viewer = viewChild(PowerPointViewerComponent);
	private readonly customShell = viewChild(HostOwnedHeadlessEditorComponent);
	constructor() {
		const translate = inject(TranslateService);
		for (const [language, messages] of Object.entries({
			en: translationsEn,
			de: translationsDe,
			es: translationsEs,
			fr: translationsFr,
			'zh-CN': translationsZhCN,
		})) {
			translate.setTranslation(language, messages);
		}
		translate.use('en');
		let disposed = false;
		inject(DestroyRef).onDestroy(() => {
			disposed = true;
			this.host()?.dispose();
		});
		void createHostOwnedDemo(import.meta.env.VITE_COLLAB_SERVER_URL?.trim())
			.then((session) => {
				if (disposed) {
					session.dispose();
					return;
				}
				this.host.set(session);
				session.attachControls(
					(value) => this.mounted.set(value),
					async () =>
						this.headless ? this.customShell()?.getContent() : this.viewer()?.getContent(),
					this.headless ? { setScale: (scale) => this.customShell()?.setScale(scale) } : undefined,
				);
				return undefined;
			})
			.catch((reason: unknown) => this.error.set(String(reason)));
	}
}

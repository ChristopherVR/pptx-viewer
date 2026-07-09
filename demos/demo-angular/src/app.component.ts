import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	inject,
	signal,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import {
	isAudienceTab,
	loadAudienceContent,
	PowerPointViewerComponent,
	translationsEn,
} from 'pptx-angular-viewer';
import type { CollaborationConfig, ViewerTheme } from 'pptx-angular-viewer';
import { PptxHandler } from 'pptx-viewer-core';
import 'pptx-angular-viewer/styles';

import {
	ensureAutoRoomId,
	generateAutoName,
	isTrustedServerUrl,
	randomCursorColor,
	resolveDefaultServerUrl,
} from './collab-utils';
import { demoStringsDe, demoStringsEn, demoStringsFr, demoStringsEs } from './demo-locales';
import { DropzoneComponent } from './dropzone.component';
import { translationsEs, translationsFr, translationsDe } from './i18n-locales';
import { LanguagePickerComponent } from './language-picker.component';
import { persistLanguageKey, restoreLanguageKey } from './languages';
import { ThemePickerComponent } from './theme-picker.component';
import { persistThemeKey, restoreThemeKey, THEMES } from './themes';

type DemoContent = Uint8Array | ArrayBuffer;

/**
 * Angular demo app: mirrors the React demo (demos/demo-react/main.tsx).
 *
 * There is no header bar; the viewer fills the screen and a floating theme
 * picker hovers above it. Collaboration / broadcast / audience flows are driven
 * from URL params and auto-connect to trusted servers only.
 */
@Component({
	selector: 'app-root',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		PowerPointViewerComponent,
		ThemePickerComponent,
		LanguagePickerComponent,
		DropzoneComponent,
	],
	styles: [
		`
			:host {
				display: block;
				height: 100dvh;
				width: 100vw;
				overflow: hidden;
				font-family:
					system-ui,
					-apple-system,
					'Segoe UI',
					Roboto,
					sans-serif;
			}
			.demo-viewer-host {
				height: 100dvh;
				width: 100vw;
			}
		`,
	],
	template: `
		<app-theme-picker [current]="themeKey()" (themeChange)="onThemeChange($event)" />
		<app-language-picker
			[current]="languageKey()"
			[theme]="themeKey()"
			(languageChange)="onLanguageChange($event)"
		/>

		@if (content()) {
			<div class="demo-viewer-host">
				<pptx-viewer
					[content]="content()!"
					[theme]="activeTheme()"
					[canEdit]="true"
					[fileName]="fileName()"
					[filePath]="fileName() || undefined"
					[smartArt3D]="smartArt3D"
					[authorName]="autoName"
					[shareDefaults]="{ roomId: autoRoomId, userName: autoName, serverUrl: defaultServerUrl }"
					[collaboration]="collaborationConfig() ?? undefined"
					(startCollaboration)="handleStartCollaboration($event)"
					(stopCollaboration)="handleStopCollaboration()"
					(dirtyChange)="onDirtyChange($event)"
				/>
			</div>
		} @else {
			<app-dropzone
				[theme]="activeTheme()"
				[urlRoom]="urlRoom"
				[urlBroadcast]="urlBroadcast"
				[busy]="isBusy()"
				(file)="loadFile($event)"
				(create)="newPresentation()"
			/>
		}
	`,
})
export class AppComponent {
	readonly content = signal<DemoContent | null>(null);
	readonly fileName = signal<string>('');
	readonly themeKey = signal<string>(restoreThemeKey());
	readonly languageKey = signal<string>(restoreLanguageKey());
	readonly isBusy = signal<boolean>(false);
	private readonly translate = inject(TranslateService);

	private readonly params = new URLSearchParams(window.location.search);
	/** Opt in to the experimental Three.js SmartArt renderer via `?smartArt3D=1`. */
	readonly smartArt3D = this.params.get('smartArt3D') === '1';
	readonly urlRoom = this.params.get('room');
	readonly urlBroadcast = this.params.get('broadcast');
	private readonly urlServer = this.params.get('server') ?? resolveDefaultServerUrl();
	private readonly urlName = this.params.get('name');
	/** Serverless peer-to-peer join requested via `?transport=webrtc`. */
	private readonly webrtcRequested = this.params.get('transport') === 'webrtc';
	/** Optional `?signaling=a,b` WebRTC signaling server override. */
	private readonly signaling = (this.params.get('signaling') ?? '')
		.split(',')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);

	readonly autoName = generateAutoName();
	/** Stable per-session room id, seeded into the Share dialog defaults. */
	readonly autoRoomId = ensureAutoRoomId();
	/** Default collaboration server URL for the Share dialog (trusted ws relay in dev). */
	readonly defaultServerUrl = resolveDefaultServerUrl();

	readonly collaborationConfig = signal<CollaborationConfig | null>(null);

	readonly activeTheme = computed<ViewerTheme>(
		() => (THEMES[this.themeKey()] ?? THEMES['vermilionDark']).theme,
	);

	constructor() {
		this.translate.setTranslation('en', { ...translationsEn, ...demoStringsEn });
		this.translate.setTranslation('fr', { ...translationsFr, ...demoStringsFr });
		this.translate.setTranslation('es', { ...translationsEs, ...demoStringsEs });
		this.translate.setTranslation('de', { ...translationsDe, ...demoStringsDe });
		this.translate.use(this.languageKey());

		this.autoConnectFromUrl();
		this.joinFromUrl();
		void this.loadAudienceTab();

		// Keep the document title in sync with the collaboration / broadcast role.
		effect(() => {
			const config = this.collaborationConfig();
			const loaded = this.content();
			if (config && loaded) {
				const prefix =
					config.role === 'viewer'
						? '[Watching]'
						: config.role === 'owner'
							? '[Broadcasting]'
							: '[Collab]';
				document.title = `${prefix} ${this.fileName()} - PPTX Viewer`;
			}
		});
	}

	onThemeChange(key: string): void {
		this.themeKey.set(key);
		persistThemeKey(key);
	}

	onLanguageChange(code: string): void {
		this.languageKey.set(code);
		persistLanguageKey(code);
		this.translate.use(code);
	}

	onDirtyChange(dirty: boolean): void {
		const name = this.fileName();
		document.title = dirty ? `* ${name} - PPTX Viewer` : `${name} - PPTX Viewer`;
	}

	/**
	 * Started a Share or Broadcast session from the viewer's dialog: persist the
	 * config, reflect it in the URL (`?broadcast=` for owner role, else `?room=`)
	 * and upload the deck bytes so joiners can download it (trusted hosts only).
	 */
	handleStartCollaboration(config: CollaborationConfig): void {
		this.collaborationConfig.set(config);
		const url = new URL(window.location.href);
		if (config.role === 'owner') {
			url.searchParams.set('broadcast', config.roomId);
		} else {
			url.searchParams.set('room', config.roomId);
		}
		if (config.transport === 'webrtc') {
			// Serverless P2P: carry the transport, not a (blank) server URL.
			url.searchParams.set('transport', 'webrtc');
			url.searchParams.delete('server');
			if (config.signaling?.length) {
				url.searchParams.set('signaling', config.signaling.join(','));
			}
		} else {
			url.searchParams.set('server', config.serverUrl);
			url.searchParams.delete('transport');
			url.searchParams.delete('signaling');
		}
		window.history.replaceState({}, '', url.toString());
		const bytes = this.content();
		// P2P has no file server; joiners receive the deck via Y.Doc sync instead.
		if (bytes && config.transport !== 'webrtc' && isTrustedServerUrl(config.serverUrl)) {
			const httpUrl = config.serverUrl.replace(/^ws/u, 'http');
			void fetch(`${httpUrl}/file/${encodeURIComponent(config.roomId)}`, {
				method: 'POST',
				body: bytes as BodyInit,
			}).catch(() => {
				// Server may not support file storage; joiners fall back to IndexedDB.
			});
		}
	}

	/** Stopped collaborating: clear the config and strip the URL params. */
	handleStopCollaboration(): void {
		this.collaborationConfig.set(null);
		const url = new URL(window.location.href);
		url.searchParams.delete('room');
		url.searchParams.delete('broadcast');
		url.searchParams.delete('server');
		url.searchParams.delete('transport');
		url.searchParams.delete('signaling');
		url.searchParams.delete('name');
		window.history.replaceState({}, '', url.toString());
	}

	// ── File loading ─────────────────────────────────────────────────────────
	async loadFile(file: File): Promise<void> {
		this.fileName.set(file.name);
		this.content.set(new Uint8Array(await file.arrayBuffer()));
	}

	async newPresentation(): Promise<void> {
		this.isBusy.set(true);
		try {
			const { handler, data } = await PptxHandler.createBlank({
				title: 'Untitled Presentation',
				initialSlideCount: 1,
			});
			const bytes = await handler.save(data.slides);
			this.content.set(bytes);
			this.fileName.set('Untitled Presentation');
		} finally {
			this.isBusy.set(false);
		}
	}

	// ── Collaboration / broadcast / audience wiring ──────────────────────────
	private autoConnectFromUrl(): void {
		const joinRoomId = this.urlRoom ?? this.urlBroadcast;
		if (!joinRoomId) {
			return;
		}
		const role = this.urlBroadcast ? ('viewer' as const) : undefined;

		// Serverless peer-to-peer: no server to trust; join over WebRTC directly.
		if (this.webrtcRequested) {
			this.collaborationConfig.set({
				roomId: joinRoomId,
				serverUrl: '',
				transport: 'webrtc',
				...(this.signaling.length > 0 ? { signaling: this.signaling } : {}),
				userName: this.urlName ?? this.autoName,
				userColor: randomCursorColor(),
				...(role ? { role } : {}),
			});
			return;
		}

		if (!isTrustedServerUrl(this.urlServer)) {
			console.warn(
				`Ignoring auto-connect because ?server=${this.urlServer} is not in the trusted-host allowlist. Use the Share dialog to connect explicitly.`,
			);
			return;
		}
		this.collaborationConfig.set({
			roomId: joinRoomId,
			serverUrl: this.urlServer,
			userName: this.urlName ?? this.autoName,
			userColor: randomCursorColor(),
			...(role ? { role } : {}),
		});
	}

	private joinFromUrl(): void {
		const joinRoomId = this.urlRoom ?? this.urlBroadcast;
		if (!joinRoomId || this.content()) {
			return;
		}
		// Serverless peer-to-peer: there is no file server to fetch from. Bootstrap
		// a placeholder deck so the viewer mounts and connects; the Y.Doc
		// late-joiner sync then populates the real slides via applyRemoteSlides.
		if (this.webrtcRequested) {
			void this.bootstrapForRemoteSync();
			return;
		}
		if (!isTrustedServerUrl(this.urlServer)) {
			console.warn(
				`Refusing to fetch presentation from untrusted ?server=${this.urlServer}. Add the host to the trusted-host allowlist or use the Share dialog.`,
			);
			return;
		}
		void this.downloadFromServer(joinRoomId);
		this.scheduleAudienceFallback();
	}

	/** Bootstrap a blank deck so a serverless (webrtc) joiner mounts + syncs. */
	private async bootstrapForRemoteSync(): Promise<void> {
		if (this.content()) {
			return;
		}
		const { handler, data } = await PptxHandler.createBlank({
			title: 'Collaboration Session',
			initialSlideCount: 1,
		});
		const bytes = await handler.save(data.slides);
		if (this.content()) {
			return;
		}
		this.content.set(bytes);
		this.fileName.set(this.urlBroadcast ? 'Broadcast Session' : 'Collaboration Session');
	}

	private async downloadFromServer(joinRoomId: string): Promise<void> {
		const httpUrl = this.urlServer.replace(/^ws/u, 'http');
		try {
			const res = await fetch(`${httpUrl}/file/${encodeURIComponent(joinRoomId)}`);
			if (!res.ok) {
				throw new Error('Not found');
			}
			const buf = await res.arrayBuffer();
			if (this.content()) {
				return;
			}
			this.content.set(new Uint8Array(buf));
			this.fileName.set(this.urlBroadcast ? 'Broadcast Session' : 'Collaboration Session');
		} catch {
			// File not available on server; the IndexedDB fallback may still recover it.
		}
	}

	/** Fallback: try IndexedDB if the server download didn't work (same-browser tabs). */
	private scheduleAudienceFallback(): void {
		setTimeout(() => {
			void this.tryAudienceFallback();
		}, 1500);
	}

	private async tryAudienceFallback(): Promise<void> {
		if (this.content()) {
			return;
		}
		const bytes = await loadAudienceContent();
		if (!bytes || this.content()) {
			return;
		}
		this.content.set(bytes);
		this.fileName.set('Collaboration Session');
	}

	/** When opened as an audience tab, load the PPTX content from IndexedDB. */
	private async loadAudienceTab(): Promise<void> {
		if (!isAudienceTab()) {
			return;
		}
		const bytes = await loadAudienceContent();
		if (!bytes || this.content()) {
			return;
		}
		this.content.set(bytes);
		this.fileName.set('Audience View');
	}
}

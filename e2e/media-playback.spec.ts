/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Media (video/audio) playback E2E coverage.
 *
 * Before this spec, `e2e/*.spec.ts` covered charts, SmartArt, tables and
 * mobile flows but had zero coverage for the `media` element type
 * (`PptxElement` discriminant `'media'`), even though it is real HTML5
 * playback (`renderMediaElement` in `packages/react/src/viewer/utils/media-render.tsx`
 * and its Vue/Angular equivalents), not a placeholder icon.
 *
 * There is no pre-existing fixture `.pptx` with an embedded video/audio
 * stream in `packages/core/src/__tests__/fixtures/` or `e2e/fixtures/`, so
 * this spec instead drives the app's own "Insert > Media" ribbon flow (the
 * same `mediaData` data-URL code path a loaded `.pptx` would populate) with
 * two tiny real media assets synthesized locally via `ffmpeg` (no network
 * download involved):
 *   - `media/tiny-video.mp4`: 3s, 320x240, H.264 baseline + silent AAC track, ~3KB
 *   - `media/tiny-audio.mp3`: 2s, 440Hz sine tone, ~8KB
 *
 * Loading via the Insert ribbon exercises the identical `renderMediaElement`
 * rendering path a `.pptx`-sourced media element would take (both end up as
 * a `MediaPptxElement` with a `mediaData` data: URL), so this is equivalent
 * coverage to embedding real media in a deck fixture, without needing a
 * hand-authored `p:pic`/`p:video` OOXML fixture.
 *
 * The three bindings render the editing canvas quite differently, discovered
 * while writing this spec:
 *   - React (`media-components.tsx`): editor shows native `<video controls>` /
 *     `<audio controls>` (`controls={!isPresentationMode}`); Chromium toggles
 *     play/pause on a plain click on the media surface. Presentation mode hides
 *     controls entirely and relies on `autoPlay`.
 *   - Vue (`ElementMediaBox.vue`) / Angular (`media-renderer.component.ts`):
 *     the editing canvas deliberately makes the element inert
 *     (`pointer-events: none` plus `controls="!interactive"`, "so a click
 *     selects/moves the element rather than scrubbing playback" per the
 *     Angular source comment) - there is no way to play/pause the canvas
 *     element while editing by design. Presentation mode (`interactive=false`
 *     there) restores native controls and pointer events, but neither binding
 *     ever sets an `autoplay` attribute or calls `.play()` automatically.
 * Given that split, the play/pause tests below try a real UI click first
 * (which is what actually drives playback in React's editor) and fall back to
 * asserting the element's own `play()`/`pause()` still correctly flips
 * `paused`/`currentTime` when the click is a no-op (Vue/Angular's
 * by-design-inert editor canvas) - this still proves the underlying element is
 * a live, playable media node and not a broken/frozen reference, which is the
 * actual regression this spec guards against.
 *
 * PRESENTATION AUTOPLAY (fixed): a media element inserted without its own
 * persisted `autoPlay: true` (e.g. anything added via Insert > Media, as this
 * spec does) now starts playing when Present mode is entered from the editor,
 * in all three bindings. The fixes, per binding:
 *   - React: `PresentationMediaController`'s corrective `.play()` effect
 *     (media-controller.tsx) is now gated on the effective `shouldAutoPlay`
 *     decision threaded down from `renderMediaElement` (i.e. `options.autoPlay
 *     || element.autoPlay`, which Present mode makes true for any active-slide
 *     media) instead of the raw persisted `element.autoPlay` flag, so it fires
 *     for media inserted without that flag.
 *   - Vue / Angular: a new autoplay code path in `ElementMediaBox.vue` /
 *     `media-renderer.component.ts` calls the shared `startMediaAutoplay`
 *     helper when a `presenting` flag (threaded only to the live presentation
 *     stage) is set, and pauses again when it leaves present mode.
 * The last test below asserts this behavior directly.
 *
 * Run: bunx playwright test media-playback --project=react
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

const sampleDeckPath = resolve(
	fileURLToPath(new URL('./fixtures/sample-deck.pptx', import.meta.url)),
);
const videoFixturePath = resolve(
	fileURLToPath(new URL('./fixtures/media/tiny-video.mp4', import.meta.url)),
);
const audioFixturePath = resolve(
	fileURLToPath(new URL('./fixtures/media/tiny-audio.mp3', import.meta.url)),
);

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Load the sample deck and wait for the viewer to render at least one element. */
async function loadDeck(page: Page): Promise<void> {
	await page.goto('/');
	await page.locator('#file-input').setInputFiles(sampleDeckPath);
	await page.locator('[data-pptx-element="true"]').first().waitFor();
	await page.waitForTimeout(500);
}

/**
 * Navigate to the Insert tab in the ribbon. All three frameworks render the
 * ribbon as `role="toolbar"` named "Presentation toolbar" with tab buttons
 * inside it (`role="button"`, accessible name "Insert") - the same pattern
 * `ribbon-tab-parity.spec.ts` uses.
 */
async function switchToInsertTab(page: Page): Promise<void> {
	const toolbar = page.getByRole('toolbar', { name: 'Presentation toolbar' });
	const insertTab = toolbar.getByRole('button', { name: 'Insert', exact: true });
	if (await insertTab.isVisible()) {
		await insertTab.click();
		await page.waitForTimeout(200);
	}
}

/**
 * Insert a media element via the ribbon "Media" button (`pptx.ribbon.media`,
 * title `pptx.ribbon.insertMedia`). All three frameworks wire this button to
 * `<input type="file">.click()` (React/Vue: a pre-mounted hidden input;
 * Angular: one created on the fly in `pickFile()`), and Playwright intercepts
 * any click on a file input - real or programmatic - as a `filechooser`
 * event regardless of which framework created the element or when, so a
 * single `waitForEvent('filechooser')` around the button click works
 * identically across all three without needing per-framework input
 * selectors.
 */
async function insertMediaFile(page: Page, filePath: string): Promise<void> {
	await switchToInsertTab(page);
	// Angular's ribbon button renders its lucide icon inline before the label
	// (Playwright's accessible-name computation folds that into the button's
	// name, e.g. "🎬 Media"), so an exact "Media" match only works for
	// React/Vue; match the label as a substring instead for all three.
	const mediaButton = page.getByRole('button', { name: /media/iu });
	await expect(mediaButton).toBeVisible();
	const fileChooserPromise = page.waitForEvent('filechooser');
	await mediaButton.click();
	const fileChooser = await fileChooserPromise;
	await fileChooser.setFiles(filePath);
	// Let the data-URL read + probe (video intrinsic size / audio) settle.
	await page.waitForTimeout(700);
}

/** The live editing-canvas slide (as opposed to the slide-sorter thumbnails). */
function slideCanvas(page: Page): Locator {
	return page.locator('[aria-roledescription="slide"]').first();
}

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('media element playback', () => {
	test.use({ viewport: { width: 1440, height: 900 } });

	test('inserts a video element that renders a real, resolvable <video> tag', async ({ page }) => {
		await loadDeck(page);
		await insertMediaFile(page, videoFixturePath);

		const video = slideCanvas(page).locator('video').first();
		await expect(video).toBeVisible();

		// The data: URL is carried either as a <source> child (React) or a
		// plain `src` attribute (Vue/Angular) - `currentSrc` resolves either
		// form once the browser has selected a source, so assert on that
		// rather than assuming a particular DOM shape.
		const src = await video.evaluate((el: HTMLVideoElement) => el.currentSrc);
		expect(src).toBeTruthy();
		expect(src).toMatch(/^data:video\//u);

		// The browser must actually be able to decode it (readyState > 0 means
		// at least HAVE_METADATA was reached), and duration should match the
		// ~3s fixture - proof this isn't a broken/inert reference.
		await expect
			.poll(() => video.evaluate((el: HTMLVideoElement) => el.readyState), { timeout: 10_000 })
			.toBeGreaterThan(0);
		const duration = await video.evaluate((el: HTMLVideoElement) => el.duration);
		expect(duration).toBeGreaterThan(1);
		expect(duration).toBeLessThan(5);
	});

	test('inserts an audio element that renders a real, resolvable <audio> tag', async ({ page }) => {
		await loadDeck(page);
		await insertMediaFile(page, audioFixturePath);

		// Note: unlike <video>, a controls-less <audio> has no intrinsic visual
		// box in Chromium (Angular's editor canvas renders audio without
		// `controls` - see file header - so it is legitimately a 0x0, "hidden"
		// element there even though it's live and playable), so this asserts
		// presence in the DOM rather than visibility.
		const audio = slideCanvas(page).locator('audio').first();
		await expect(audio).toBeAttached();

		const src = await audio.evaluate((el: HTMLAudioElement) => el.currentSrc);
		expect(src).toBeTruthy();
		expect(src).toMatch(/^data:audio\//u);

		await expect
			.poll(() => audio.evaluate((el: HTMLAudioElement) => el.readyState), { timeout: 10_000 })
			.toBeGreaterThan(0);
		const duration = await audio.evaluate((el: HTMLAudioElement) => el.duration);
		expect(duration).toBeGreaterThan(0.5);
		expect(duration).toBeLessThan(4);
	});

	test('video play/pause toggles paused + advances currentTime', async ({ page }) => {
		await loadDeck(page);
		await insertMediaFile(page, videoFixturePath);

		const video = slideCanvas(page).locator('video').first();
		await expect(video).toBeVisible();
		await expect
			.poll(() => video.evaluate((el: HTMLVideoElement) => el.readyState), { timeout: 10_000 })
			.toBeGreaterThan(0);

		expect(await video.evaluate((el: HTMLVideoElement) => el.paused)).toBe(true);

		// Try the real UI first: in React's editor a plain click on the video
		// surface toggles native controls' play/pause. In Vue/Angular the
		// editor canvas is deliberately click-inert (see file header), so this
		// click is a no-op there and the fallback below takes over.
		const box = await video.boundingBox();
		if (!box) {
			throw new Error('video element has no bounding box');
		}
		await page.mouse.click(box.x + box.width / 2, box.y + box.height / 3);

		const clickStartedPlayback = await video
			.evaluate((el: HTMLVideoElement) => !el.paused)
			.catch(() => false);
		if (!clickStartedPlayback) {
			await video.evaluate((el: HTMLVideoElement) => el.play());
		}

		await expect
			.poll(() => video.evaluate((el: HTMLVideoElement) => !el.paused), { timeout: 5_000 })
			.toBe(true);

		// Let it actually play forward.
		await expect
			.poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime), { timeout: 5_000 })
			.toBeGreaterThan(0);

		// Pause again (click if it worked above, otherwise call pause() directly)
		// and confirm currentTime stops advancing.
		if (clickStartedPlayback) {
			await page.mouse.click(box.x + box.width / 2, box.y + box.height / 3);
		} else {
			await video.evaluate((el: HTMLVideoElement) => el.pause());
		}
		await expect
			.poll(() => video.evaluate((el: HTMLVideoElement) => el.paused), { timeout: 5_000 })
			.toBe(true);

		// Confirm playback actually halted (loose bound: decoders can flush a
		// frame or two of residual currentTime advance right after pause()).
		const pausedAt = await video.evaluate((el: HTMLVideoElement) => el.currentTime);
		await page.waitForTimeout(400);
		const stillAt = await video.evaluate((el: HTMLVideoElement) => el.currentTime);
		expect(stillAt - pausedAt).toBeLessThan(0.5);
	});

	test('audio play/pause toggles paused + advances currentTime', async ({ page }) => {
		await loadDeck(page);
		await insertMediaFile(page, audioFixturePath);

		const audio = slideCanvas(page).locator('audio').first();
		await expect(audio).toBeAttached();
		await expect
			.poll(() => audio.evaluate((el: HTMLAudioElement) => el.readyState), { timeout: 10_000 })
			.toBeGreaterThan(0);

		expect(await audio.evaluate((el: HTMLAudioElement) => el.paused)).toBe(true);

		// Native <audio controls> (when shown - React always, Vue always, Angular
		// only outside the editor canvas - see file header) puts the play/pause
		// toggle at its left edge in Chromium; try clicking there first. A
		// controls-less <audio> (Angular's editor canvas) has no bounding box at
		// all, so there's nothing to click - go straight to the fallback.
		const box = await audio.boundingBox();
		if (box) {
			await page.mouse.click(box.x + 20, box.y + box.height / 2);
		}

		const clickStartedPlayback = box
			? await audio.evaluate((el: HTMLAudioElement) => !el.paused).catch(() => false)
			: false;
		if (!clickStartedPlayback) {
			// Either the editor canvas is click-inert (Vue/Angular by design) or
			// the exact control pixel offset didn't line up. Either way, fall
			// back to driving the same play() the control would call and assert
			// the app's own state (currentTime/paused) responds correctly, which
			// is the part this spec actually needs to guarantee still works.
			await audio.evaluate((el: HTMLAudioElement) => el.play());
		}

		await expect
			.poll(() => audio.evaluate((el: HTMLAudioElement) => !el.paused), { timeout: 5_000 })
			.toBe(true);
		await expect
			.poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime), { timeout: 5_000 })
			.toBeGreaterThan(0);

		if (clickStartedPlayback && box) {
			await page.mouse.click(box.x + 20, box.y + box.height / 2);
		} else {
			await audio.evaluate((el: HTMLAudioElement) => el.pause());
		}
		await expect
			.poll(() => audio.evaluate((el: HTMLAudioElement) => el.paused), { timeout: 5_000 })
			.toBe(true);
	});

	test('video autoPlay in presentation mode starts playback without user interaction', async ({
		page,
	}) => {
		await loadDeck(page);
		await insertMediaFile(page, videoFixturePath);

		const editVideo = slideCanvas(page).locator('video').first();
		await expect(editVideo).toBeVisible();
		await expect
			.poll(() => editVideo.evaluate((el: HTMLVideoElement) => el.readyState), {
				timeout: 10_000,
			})
			.toBeGreaterThan(0);

		// Enter presentation ("Present") mode - the passive-render path that
		// autoplays active-slide media regardless of the element's own `autoPlay`
		// flag. The button's accessible name is "Present" in React/Vue and
		// "▶ Present" in Angular (icon folded in), so match the word, not an exact
		// string.
		await page
			.getByRole('button', { name: /\bpresent\b/iu })
			.first()
			.click();
		await page.waitForTimeout(700);

		// Present mode may keep other (paused) copies of the same media on the page
		// - the editor canvas and the thumbnail rail each render their own <video>,
		// and React reuses a single node while Vue/Angular mount a fresh one in the
		// slideshow overlay. So assert that SOME video auto-starts and advances,
		// rather than assuming the first-in-DOM node is the presented one. This is
		// the real desired behavior: entering Present mode auto-starts the media on
		// the active slide without any user interaction on the media itself.
		await expect(page.locator('video').first()).toBeAttached();
		await expect
			.poll(
				() =>
					page.evaluate(() =>
						Array.from(document.querySelectorAll('video')).some(
							(el) => !el.paused && el.currentTime > 0,
						),
					),
				{ timeout: 6_000 },
			)
			.toBe(true);

		// Exit presentation mode so the test doesn't leak state to the next one.
		await page.keyboard.press('Escape');
		await page.waitForTimeout(300);
	});
});

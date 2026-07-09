/* oxlint-disable vitest/prefer-importing-vitest-globals -- Playwright spec, `test`/`expect` come from @playwright/test */
/**
 * Basic real-time collaboration sync (React).
 *
 * Exercises the actual manual join flow end to end: a host loads a deck,
 * opens the Share dialog (the `Share` button in the ribbon tab row) and
 * clicks "Start Sharing"; that POSTs the current file to the collab relay's
 * `/file/:room` endpoint and rewrites the URL to `?room=<id>&server=<ws-url>`
 * (see `demos/demo-react/main.tsx`). A second, independent browser context
 * (simulating a second user) navigates straight to that join URL, which
 * auto-connects (the `?room=` effect in `main.tsx`) and fetches the file from
 * the relay. Both clients then hold a live `CollaborationProvider` wired to
 * the same Yjs room over `demos/demo-react/collab-server.mjs`'s websocket
 * relay (the same relay `bun run collab` starts).
 *
 * This spec is fully self-contained: it spawns its OWN demo-react dev server
 * and its OWN collab relay in `test.beforeAll`, both on dynamically-chosen
 * free ports, and tears them down in `test.afterAll`. Two reasons it does not
 * lean on `playwright.config.ts`'s shared `webServer` array (React/Vue/
 * Angular on fixed ports 4173/4175/4174):
 *
 *  1. This repo's worktrees are frequently exercised by multiple parallel
 *     agent sessions on the same machine, each in its own git worktree but
 *     sharing the OS's port space. A fixed-port dev server is a false
 *     positive waiting to happen: `reuseExistingServer` treats "something is
 *     already answering on 4173" as "my server is ready", even when that
 *     something is a DIFFERENT worktree's checkout running different code -
 *     which silently point this spec at the wrong source tree. Dynamic ports
 *     sidestep that entirely.
 *  2. The collab relay has no HTTP health-check route that returns 2xx (a
 *     plain GET to `/` is a 426 "upgrade required"), which Playwright's `url`
 *     readiness probe does not treat as ready, so it needs a manual
 *     spawn + readiness poll regardless.
 *
 * Client B performs a plain double-click-and-type inline text edit (the same
 * interaction `mobile-manipulation.spec.ts` and `save-corruption-repro.spec.ts`
 * use); client A's copy of the same shape is asserted, via `expect.poll`, to
 * pick up the edit within a few seconds over the local websocket relay. (The
 * edit is driven from B rather than A for a reason unrelated to sync itself -
 * see the in-test comment above the edit.)
 *
 * Run: bunx playwright test e2e/collaboration.spec.ts
 */
import { spawn, spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { test, expect, devices } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const fixturePath = resolve(
	fileURLToPath(new URL('./fixtures/format-painter.pptx', import.meta.url)),
);

/** Ask the OS for an unused TCP port. Small TOCTOU race, acceptable for tests. */
async function getFreePort(): Promise<number> {
	return new Promise((resolvePromise, reject) => {
		const srv = createServer();
		srv.unref();
		srv.on('error', reject);
		srv.listen(0, '127.0.0.1', () => {
			const address = srv.address();
			const port = typeof address === 'object' && address ? address.port : 0;
			srv.close(() => resolvePromise(port));
		});
	});
}

/** Poll a URL until it responds at all (any status - connection refused is the only failure). */
async function waitForHttp(url: string, timeoutMs: number): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	let lastError: unknown;
	while (Date.now() < deadline) {
		try {
			await fetch(url);
			return;
		} catch (err) {
			lastError = err;
			await new Promise((r) => {
				setTimeout(r, 200);
			});
		}
	}
	throw new Error(`Timed out waiting for ${url} to respond: ${String(lastError)}`);
}

/** Kill a spawned child (and its process tree on Windows), tolerating platform differences. */
function killTree(child: ChildProcess | undefined): void {
	if (!child || child.pid === undefined) {
		return;
	}
	if (process.platform === 'win32') {
		// A shell-spawned `bun`/`npx` process on Windows owns a sub-tree; a plain
		// kill() leaves the real server running. `taskkill /T` takes it all down.
		spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F']);
	} else {
		child.kill('SIGTERM');
	}
}

let collabProcess: ChildProcess | undefined;
let demoProcess: ChildProcess | undefined;
let collabServerUrl = '';
let demoOrigin = '';

/** Start the demo's Yjs relay on an ephemeral port; resolves once it logs readiness. */
async function startCollabServer(): Promise<void> {
	const port = await getFreePort();
	collabServerUrl = `ws://localhost:${port}`;
	await new Promise<void>((resolvePromise, reject) => {
		const child = spawn('bun', ['demos/demo-react/collab-server.mjs'], {
			cwd: repoRoot,
			env: { ...process.env, PORT: String(port) },
			stdio: ['ignore', 'pipe', 'pipe'],
			// `bun` resolves via PATH through the shell on Windows CI/dev boxes
			// (a plain ENOENT otherwise, since the executable is a shim); a shell
			// is harmless on POSIX too.
			shell: true,
		});
		collabProcess = child;

		let settled = false;
		const timer = setTimeout(() => {
			if (!settled) {
				settled = true;
				reject(new Error('Timed out waiting for the collab relay to start'));
			}
		}, 15_000);

		child.stdout?.on('data', (chunk: Buffer) => {
			if (!settled && chunk.toString().includes('running on ws://')) {
				settled = true;
				clearTimeout(timer);
				resolvePromise();
			}
		});
		child.stderr?.on('data', (chunk: Buffer) => {
			console.error(`[collab relay] ${chunk.toString()}`);
		});
		child.on('exit', (code) => {
			if (!settled) {
				settled = true;
				clearTimeout(timer);
				reject(new Error(`collab relay exited early (code ${code})`));
			}
		});
		child.on('error', (err) => {
			if (!settled) {
				settled = true;
				clearTimeout(timer);
				reject(err);
			}
		});
	});
}

/** Start a private demo-react Vite dev server on an ephemeral port. */
async function startDemoServer(): Promise<void> {
	const port = await getFreePort();
	demoOrigin = `http://localhost:${port}`;
	const child = spawn('npx', ['vite', '--port', String(port), '--strictPort'], {
		cwd: resolve(repoRoot, 'demos/demo-react'),
		stdio: ['ignore', 'pipe', 'pipe'],
		shell: true,
	});
	demoProcess = child;
	child.stderr?.on('data', (chunk: Buffer) => {
		console.error(`[demo-react vite] ${chunk.toString()}`);
	});
	await waitForHttp(demoOrigin, 30_000);
}

/** The SOURCE shape (format-painter.pptx's tagged text-bearing rectangle). */
function sourceShape(page: Page): Locator {
	return page.locator('[data-pptx-element="true"]').filter({ hasText: 'SOURCE' });
}

/** Load the fixture deck in a fresh page. */
async function openFixture(page: Page): Promise<void> {
	await page.goto(demoOrigin);
	await page.locator('#file-input').setInputFiles(fixturePath);
	await sourceShape(page).waitFor();
}

/**
 * Commit an inline text edit by clicking well away from every shape (blur
 * commits; `Escape` cancels instead - see `InlineTextEditor.tsx`'s
 * `onKeyDown`, matching `mobile-manipulation.spec.ts`'s tap-away commit).
 */
async function commitByClickingAway(page: Page): Promise<void> {
	const stage = page.locator('[aria-roledescription="slide"]').first();
	const box = await stage.boundingBox();
	if (!box) {
		throw new Error('missing stage bounding box');
	}
	await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.85);
}

test.describe('collaboration sync (React)', () => {
	test.setTimeout(90_000);

	test.beforeAll(async () => {
		await Promise.all([startCollabServer(), startDemoServer()]);
	});

	test.afterAll(() => {
		killTree(collabProcess);
		killTree(demoProcess);
	});

	test('a second client joins a session and its edit propagates back to the host', async ({
		browser,
	}, testInfo) => {
		// This spec spawns its own dedicated demo-react instance (see the file
		// header), so it only needs to run once, not once per framework project.
		test.skip(testInfo.project.name !== 'react', 'React-only: exercises demo-react directly');

		// `browser.newContext()` does not inherit a project's `use` device preset
		// the way the auto-wired `page` fixture does, so a manually created
		// context can default to a viewport small enough to trip the viewer's
		// own `isMobile` responsive breakpoint - which renders the compact touch
		// UI instead of the desktop ribbon. Force the same Desktop Chrome preset
		// the "react" project uses.
		const contextA = await browser.newContext({ ...devices['Desktop Chrome'] });
		const contextB = await browser.newContext({ ...devices['Desktop Chrome'] });
		const pageA = await contextA.newPage();
		const pageB = await contextB.newPage();

		try {
			// ── Client A: load the deck, then start a collaboration session ──
			await openFixture(pageA);

			await pageA.getByRole('button', { name: 'Share', exact: true }).click();
			const roomId = `e2e-collab-${Date.now()}`;
			await pageA.locator('#share-room-id').fill(roomId);
			await pageA.locator('#share-server-url').fill(collabServerUrl);
			await pageA.getByRole('button', { name: 'Start Sharing' }).click();

			// Read readiness from the Share dialog's own "Active session" view
			// (still open) rather than the status-bar pill: starting a session
			// wraps the already-mounted viewer in a new `CollaborationProvider`,
			// which remounts the whole editor subtree and can flip the
			// `ResizeObserver`-driven `isNarrowViewport` breakpoint, permanently
			// swapping client A into the compact mobile UI (including a bottom
			// sheet that covers the canvas) even on a desktop viewport, until the
			// page is reloaded. The dialog's own text is unaffected by that, so
			// read connectivity from there.
			await expect(pageA.getByRole('dialog', { name: 'Share Presentation' })).toContainText(
				'connected',
				{ timeout: 15_000, ignoreCase: true },
			);
			// Both the header "x" and the footer button share the accessible name
			// "Close" (the "x" via `aria-label`); filter by rendered text to land
			// on the footer one specifically.
			await pageA
				.getByRole('dialog', { name: 'Share Presentation' })
				.getByRole('button', { name: 'Close' })
				.filter({ hasText: 'Close' })
				.click();

			// ── Client B: join the same room via the URL the Share dialog would
			// hand out (the demo rewrites its own URL identically on Start). The
			// join fetches the file client A just POSTed to the relay's /file/:room
			// endpoint, and auto-connects the same Yjs room.
			const joinUrl = new URL(pageA.url());
			joinUrl.search = '';
			joinUrl.searchParams.set('room', roomId);
			joinUrl.searchParams.set('server', collabServerUrl);
			await pageB.goto(joinUrl.toString());

			await sourceShape(pageB).waitFor({ timeout: 15_000 });
			// Client B never toggles collaboration on after the fact (it is
			// collaborative from its very first mount, `collaboration` is already
			// set before `PowerPointViewer` ever renders), so it does not hit the
			// remount/breakpoint quirk above and its status-bar pill is reliable.
			await expect(pageB.getByTestId('collaboration-status')).toHaveAttribute(
				'aria-label',
				/Connected/u,
				{ timeout: 15_000 },
			);

			// ── Client B edits SOURCE's text ──
			// The edit is driven from client B rather than A: A's canvas may be
			// covered by the stuck mobile bottom sheet noted above (a real,
			// pre-existing bug independent of collaboration sync itself, worth
			// its own fix separately), which would make a *click*-based edit on A
			// unreliable. B's canvas is unaffected, and A only needs its DOM text
			// read below, not clicked, so the remount quirk does not touch this
			// test's actual subject: whether an edit propagates over the Yjs
			// websocket relay.
			const sourceB = sourceShape(pageB);
			await sourceB.dblclick();
			await pageB.locator('[data-inline-editor]').waitFor();
			await pageB.keyboard.type(' SYNCED');
			await commitByClickingAway(pageB);
			await expect(sourceB).toContainText('SYNCED');

			// ── Client A's copy of the same shape reflects the edit ──
			const sourceA = sourceShape(pageA);
			await expect.poll(async () => sourceA.textContent(), { timeout: 10_000 }).toContain('SYNCED');
		} finally {
			await contextA.close();
			await contextB.close();
		}
	});
});

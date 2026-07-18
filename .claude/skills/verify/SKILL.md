---
name: verify
description: Verify viewer/editor changes live in the demo apps (all five bindings)
---

# Verifying pptx-viewer changes live

The five demo apps are the runtime surface for binding/package changes. Each
demo's vite config aliases the package specifiers to **library source**, so
edits in `packages/*/src` are live on reload with no package rebuild, with one
exception: after adding a NEW export to `pptx-viewer-shared`, run
`bun run build` in `packages/shared` once (some consumers resolve its dist).

## Launch

- `bun run demo` (React, 4173), `demo:angular` (4174), `demo:vue` (4175),
  `demo:vanilla` (4176), `demo:svelte` (4177), from the repo root.
- Servers are often ALREADY running from a parallel session; check
  `netstat -ano | grep -E ":(4173|4174|4175|4176|4177) .*LISTENING"` first and
  just reuse them (vite serves current sources on reload).
- The Playwright MCP browser profile may be locked by a parallel session
  ("Browser is already in use"); fall back to the claude-in-chrome tools.

## Drive

- Landing page: click "or create a New Presentation" to get an editable deck
  without a fixture (Svelte demo may boot in French locale; same button).
- Sample decks: the demos serve `e2e/fixtures` as their public dir.
- Editing chrome mirrors PowerPoint: ribbon tabs along the top; element
  double-click opens type-specific editors (equations open the equation
  dialog, text enters inline edit).
- Screenshot timeouts ("renderer may be frozen") right after a click are
  transient; retry once and it succeeds.

## Gotchas

- The working tree is shared with parallel agent sessions: `git status` noise
  is often not yours, and dev servers/browser profiles may be theirs too.
- Zombie vite servers on the demo ports can serve stale code after big
  refactors; if behavior doesn't match source, kill the PID and relaunch.

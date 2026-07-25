<!--
Thanks for contributing. Please read CONTRIBUTING.md if you have not already:
https://github.com/ChristopherVR/pptx-viewer/blob/main/CONTRIBUTING.md

Delete any section that genuinely does not apply.
-->

## What does this change?

<!-- One or two sentences. Link the issue if there is one: Fixes #123 -->

## Type of change

- [ ] Bug fix (non-breaking)
- [ ] New feature (non-breaking)
- [ ] Breaking change
- [ ] Docs / tooling / CI only

---

## Cross-binding parity

**Skip this section only if your change touches no UI at all** (core parsing or
serialization, docs, CI, tooling). Everything else must fill it in.

This project ships the same viewer through five bindings. A user on Svelte is
entitled to the feature set a user on React gets, so parity is a merge
requirement. See
[the parity rule](https://github.com/ChristopherVR/pptx-viewer/blob/main/CONTRIBUTING.md#the-parity-rule-read-this-before-writing-ui-code).

### Which bindings did you check, and what did you find?

<!--
Be honest here. "Checked" means you actually ran the demo or a test against it,
not that you assumed. Reviewers care more about an accurate map than a clean one.
-->

| Binding                      | Affected?    | Fixed / implemented here? | Notes |
| ---------------------------- | ------------ | ------------------------- | ----- |
| React (`packages/react`)     | yes / no / ? |                           |       |
| Vue (`packages/vue`)         | yes / no / ? |                           |       |
| Angular (`packages/angular`) | yes / no / ? |                           |       |
| Svelte (`packages/svelte`)   | yes / no / ? |                           |       |
| Vanilla (`packages/vanilla`) | yes / no / ? |                           |       |

### New UI feature

- [ ] The framework-agnostic logic lives in `pptx-viewer-shared`, not duplicated
      per binding
- [ ] Implemented in **all five** bindings
- [ ] User-visible copy is routed through `t()` / `translate` with keys added to
      `translations-en.ts` **and** `packages/locales/src/{de,es,fr}/`

### UI fix

- [ ] I reproduced the bug (or confirmed its absence) in every binding above
- [ ] Every affected binding is fixed in this PR

If any affected binding is **not** fixed here, say which and why, and link the
tracking issue:

<!-- e.g. "Angular needs a change-detection refactor first, tracked in #123" -->

---

## Testing

- [ ] Unit tests added or updated for each binding I changed
- [ ] Regression test added that fails without this change
- [ ] Framework-neutral e2e spec added or updated in `e2e/`
      (required for new UI features; it is how a binding is stopped from
      quietly falling behind)
- [ ] `bun run e2e` passes locally, or I have named the projects I ran

If you did not add an e2e spec for a UI change, explain why:

<!-- -->

## Checks run locally

- [ ] `bun run lint`
- [ ] `bun run fmt:check`
- [ ] `bun run typecheck`
- [ ] `bun run test`

## Conventional Commits

- [ ] My commit messages follow
      [Conventional Commits](https://www.conventionalcommits.org)

Commit types drive **published package version bumps**, and non-conforming
commits are dropped from the changelog entirely, so this is load-bearing.
`feat` bumps minor, `fix`/`perf`/`refactor`/`chore` bump patch, `!` or a
`BREAKING CHANGE:` footer bumps major. Which package gets bumped is decided by
the **paths** the commit touches, so keep commits within one package where you
can.

## Screenshots / recordings

<!--
For UI changes, a screenshot per affected binding is worth a lot. Even two
(the React reference plus the binding you were least sure about) helps.
-->

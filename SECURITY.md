# Security Policy

## Supported versions

Each published package in this monorepo is versioned and released independently
(see [CLAUDE.md](./CLAUDE.md#commit-conventions) for the release process). Security
fixes are only backported to the **latest published version of each package**; we do
not maintain long-lived security-fix branches for older majors.

| Package            | npm name                     |
| ------------------ | ---------------------------- |
| `packages/core`    | `pptx-viewer-core`           |
| `packages/react`   | `pptx-react-viewer`          |
| `packages/vue`     | `pptx-vue-viewer`            |
| `packages/angular` | `pptx-angular-viewer`        |
| `packages/cli`     | `@christophervr/pptx-viewer` |
| `packages/tools`   | `pptx-viewer-mcp`            |

`packages/shared` (`pptx-viewer-shared`) is a private, unpublished internal package
vendored into the bindings above at build time; it has no independent version to
target, but a vulnerability there is fixed via whichever binding(s) ship the
affected code path.

Always upgrade to the latest version of the package(s) you depend on before
reporting a suspected vulnerability, in case it has already been fixed.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report vulnerabilities privately using
[GitHub's private vulnerability reporting](https://github.com/ChristopherVR/pptx-viewer/security/advisories/new)
(the "Report a vulnerability" button under this repository's **Security** tab).
This opens a private advisory visible only to the maintainers until a fix is
ready, and lets you attach a proof of concept without exposing it publicly.

If you're unable to use GitHub's private reporting for any reason, open a
regular issue asking a maintainer to reach out and provide the details out of
band; do not include exploit details in the issue itself.

Please include as much of the following as you can:

- The affected package(s) and version(s).
- A description of the vulnerability and its potential impact.
- Steps to reproduce, ideally a minimal repro (ideally a crafted `.pptx`/`.docx`-style
  input, or a code snippet) - this project parses untrusted binary/XML input
  (PPTX/OOXML files, embedded fonts, EMF/WMF metafiles, digital signatures), so
  parser crashes, hangs (ReDoS), memory exhaustion, and XSS via rendered slide
  content are all in scope, not just "classic" injection bugs.
- Whether the issue requires a specially-crafted file to be opened/loaded, or is
  reachable from untrusted network/user input in some other way.

## Response expectations

This is a side project maintained outside of full-time work, not a funded or
staffed effort, so there's no fixed SLA on response times - reports are
triaged and fixed when maintainer time allows rather than on a guaranteed
schedule. That said, we do take reports seriously and will get to them.

Once a fix is ready, we'll coordinate a disclosure timeline with the reporter
before any public advisory or changelog entry is published. We credit
reporters in the advisory unless you ask to remain anonymous.

## Scope

In scope:

- All packages under `packages/` and their published npm artifacts.
- The MCP server/tooling in `packages/tools`.
- The demo apps under `demos/` only insofar as a bug there reveals a
  vulnerability in one of the published packages they consume (the demos
  themselves are not published or deployed as a security-relevant surface).

Out of scope:

- Vulnerabilities that require the presentation author and the viewer to
  already fully trust each other, with no untrusted file/content boundary
  crossed (e.g. a user deliberately loading their own malicious file into
  their own local instance with no other party involved).
- Findings from automated scanners without a demonstrated, concrete impact
  (e.g. a generic dependency CVE with no reachable code path in this project).
  Dependency vulnerabilities are already tracked via Dependabot
  (`.github/dependabot.yml`); feel free to open a normal issue for those.

## Automated scanning

This repository runs GitHub CodeQL code scanning on every push to `main`.
Findings are triaged and fixed as part of normal development; you don't need
to separately report something that's already visible in the repository's
public [code scanning alerts](https://github.com/ChristopherVR/pptx-viewer/security/code-scanning),
though private vulnerability reporting is still preferred for anything with a
working exploit.

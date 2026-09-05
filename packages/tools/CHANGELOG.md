# Changelog

All notable changes to this project are documented here.
This file is generated from [Conventional Commits](https://www.conventionalcommits.org)
by [git-cliff](https://git-cliff.org); do not edit it by hand.
A release listed with no entries carried no Conventional Commit in this package's
scope: scripts/release-plan.mjs re-releases a package whenever any of its files
change, not only on conventional ones.

## [2.2.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-mcp@2.2.0) - 2026-09-05

### Features

- **tools:** Chart userShapes MCP tools (by @ChristopherVR) ([bf851eb](https://github.com/ChristopherVR/pptx-viewer/commit/bf851eb9fd29bfbe447157d8b1e7340644d5d921))

## [2.1.7](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-mcp@2.1.7) - 2026-08-26

### Dependencies

- **deps:** Update fast-xml-parser requirement from ^5.10.1 to ^5.11.0 ([#177](https://github.com/ChristopherVR/pptx-viewer/issues/177)) (by @dependabot[bot]) ([a876e0f](https://github.com/ChristopherVR/pptx-viewer/commit/a876e0f5fd07fd2e7063619882313cc23c4a0162))

## [2.1.6](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-mcp@2.1.6) - 2026-08-22

### Bug Fixes

- **tools:** Widen the core dependency range to the new major (by @ChristopherVR) ([0221c2b](https://github.com/ChristopherVR/pptx-viewer/commit/0221c2b05b7bf2ff0d87034a1564673eee574c45))

## [2.1.5](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-mcp@2.1.5) - 2026-08-22

## [2.1.4](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-mcp@2.1.4) - 2026-08-21

### Bug Fixes

- **tools:** Normalize MCP chartType "pareto" to histogram+cumulative (by @ChristopherVR) ([c36411a](https://github.com/ChristopherVR/pptx-viewer/commit/c36411a8372d7f6a3aa89d2d3e0e67ba4baaab66))

## [2.1.3](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-mcp@2.1.3) - 2026-08-20

### Bug Fixes

- **ci:** Stop the hourly release writing an empty changelog section (by @ChristopherVR) ([d53c0fe](https://github.com/ChristopherVR/pptx-viewer/commit/d53c0feffa2c2d9c67dfc495cb8dbefdf23638ae))
- **ci:** Turn off oxlint's React Compiler rule family and fix the last irregular-whitespace hits (by @ChristopherVR) ([30c6bd8](https://github.com/ChristopherVR/pptx-viewer/commit/30c6bd84de19bd4168b8b3f1035ae8d6de16efe1))

## [2.1.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-mcp@2.1.2) - 2026-08-13

### Testing

- **e2e:** Add the corpus round-trip harness and a COM acceptance gate (by @ChristopherVR) ([edf6dd5](https://github.com/ChristopherVR/pptx-viewer/commit/edf6dd5f23d2644bae5ad290c9f755055537ae51))

## [2.1.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-mcp@2.1.1) - 2026-08-10

### Dependencies

- **deps:** Update yjs requirement from ^13.6.31 to ^13.6.32 ([#152](https://github.com/ChristopherVR/pptx-viewer/issues/152)) (by @dependabot[bot]) ([456fdb8](https://github.com/ChristopherVR/pptx-viewer/commit/456fdb8493487ab3e346714755239a90698f6b4d))
- **deps:** Update @modelcontextprotocol/sdk requirement ([#153](https://github.com/ChristopherVR/pptx-viewer/issues/153)) (by @dependabot[bot]) ([974413f](https://github.com/ChristopherVR/pptx-viewer/commit/974413f162851d16dc1816ce6d94d3d80a5ff817))

## [2.1.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-mcp@2.1.0) - 2026-08-07

### Features

- **core:** Export and import decks as portable JSON (by @ChristopherVR) ([965fc05](https://github.com/ChristopherVR/pptx-viewer/commit/965fc05ce0993d97a15d6199c8763eada99fa646))
- **shared:** Blackboard mode, element rename and column charts (by @ChristopherVR) ([a69ffce](https://github.com/ChristopherVR/pptx-viewer/commit/a69ffce0a7635632cf19cb060b329a8ff5d19422))

## [2.0.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-mcp@2.0.2) - 2026-07-27

### Bug Fixes

- **ci:** Resolve workspace: ranges in every published manifest (by @ChristopherVR) ([ea35290](https://github.com/ChristopherVR/pptx-viewer/commit/ea35290721ba679571f71708933ed718e65e3942))

## [2.0.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-mcp@2.0.1) - 2026-07-25

### Bug Fixes

- **tools:** Resolve pptx-viewer-core to the workspace copy (by @ChristopherVR) ([1d4e3ff](https://github.com/ChristopherVR/pptx-viewer/commit/1d4e3ff00694d12606245de7726210d675d713f6))

### Chores

- **deps-dev:** Update tsdown requirement ([#109](https://github.com/ChristopherVR/pptx-viewer/issues/109)) (by @dependabot[bot]) ([f83aa0a](https://github.com/ChristopherVR/pptx-viewer/commit/f83aa0a0012d9678cb1fcbef3bbf45b04f179755))

## [2.0.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-mcp@2.0.0) - 2026-07-23

### Documentation

- Friendly 2.0.0 changelog for root and packages (by @ChristopherVR) ([f56564d](https://github.com/ChristopherVR/pptx-viewer/commit/f56564de0dea3f3aa6f0bdf5ad5ed1bf6e9d4823))

## 2.0.0

V2 tidies the MCP server's public API. (The exact version and date are set
when the release is tagged.)

### Breaking changes and migration

- The deprecated `runMutatingTool` re-export is removed. Call `runMcpTool`
  instead; it is a pure rename with no behavioural difference.

## [1.3.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-mcp@1.3.2) - 2026-07-18

### Documentation

- Correct and expand the per-package npm readmes (by @ChristopherVR) ([46f7c57](https://github.com/ChristopherVR/pptx-viewer/commit/46f7c573701a19e91c507d41ebdc956c64699c38))

## [1.3.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-mcp@1.3.1) - 2026-07-17

### Dependencies

- **deps:** Update outdated dependencies within semver ranges (by @ChristopherVR) ([3249d8e](https://github.com/ChristopherVR/pptx-viewer/commit/3249d8ecd53ea79089f87f942f2c88caae840466))

## [1.3.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-mcp@1.3.0) - 2026-07-16

### Documentation

- **packages:** Add package-specific readme visuals (by @ChristopherVR) ([9e20f13](https://github.com/ChristopherVR/pptx-viewer/commit/9e20f133dc8f21db75a1ca5e46e77c0af3c96d66))

## [1.2.2](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-mcp@1.2.2) - 2026-07-13

### Bug Fixes

- **build:** Restore compatibility after dependency updates (by @ChristopherVR) ([ddbfae6](https://github.com/ChristopherVR/pptx-viewer/commit/ddbfae687669b9e6c64fd3c3b16a592623b79c10))

### Dependencies

- **deps:** Update fast-xml-parser to 5.10.0 (by @dependabot[bot]) ([6080273](https://github.com/ChristopherVR/pptx-viewer/commit/6080273f6a6f603d10d69a71d54faad1e6d9bf05))
- **deps:** Update typescript to 7.0.2 (by @dependabot[bot]) ([0a7c1f1](https://github.com/ChristopherVR/pptx-viewer/commit/0a7c1f1f7f0ccdee9537f1e11177b6a39839d221))

## [1.2.1](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-mcp@1.2.1) - 2026-07-11

### Bug Fixes

- **tools:** Derive codec field lists from the canonical core schema (by @ChristopherVR) ([d594bd1](https://github.com/ChristopherVR/pptx-viewer/commit/d594bd14f46a61257e7d73cb707c7b540225e3ff))

## [1.2.0](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-mcp@1.2.0) - 2026-07-06

### Features

- **tools:** Add 26 new MCP tools expanding coverage to 51 total (by @ChristopherVR) ([c784579](https://github.com/ChristopherVR/pptx-viewer/commit/c784579cf91431eac28bb40c874b4e2cbb6d7a20))

### Bug Fixes

- **vue,react:** Resolve lint warnings and TableRenderer interactive-prop default (by @ChristopherVR) ([6a69635](https://github.com/ChristopherVR/pptx-viewer/commit/6a69635214f389dea16ceafe37b10cfcbb236540))
- **core:** Cast xmldom Element to Node for xml-crypto canonicalization (by @ChristopherVR) ([8fbd97e](https://github.com/ChristopherVR/pptx-viewer/commit/8fbd97eb1221f66650a7bcb45e089ee08034439f))

### Documentation

- **tools:** Note the codec schema diverges from the viewer sync layout (by @ChristopherVR) ([7ba5d9e](https://github.com/ChristopherVR/pptx-viewer/commit/7ba5d9ef76e95cb255f591b1483fcdab9fc824b9))

## [1.1.26](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-mcp@1.1.26) - 2026-06-21

### Features

- Extracted more shared logic into the shared package (by @ChristopherVR) ([977c608](https://github.com/ChristopherVR/pptx-viewer/commit/977c608ecdb142908b38aaa37104d983275b705b))

### Documentation

- Sharpen npm descriptions and keywords for discoverability (by @ChristopherVR) ([8fea56d](https://github.com/ChristopherVR/pptx-viewer/commit/8fea56d7650f7dc2f3167dea97b94b612a03a4e7))

## [1.1.24](https://github.com/ChristopherVR/pptx-viewer/releases/tag/pptx-viewer-mcp@1.1.24) - 2026-06-20

### Features

- **tools:** Scaffold @pptx-viewer/tools package (by @ChristopherVR) ([f34b949](https://github.com/ChristopherVR/pptx-viewer/commit/f34b949e0f6d6460710aa223146399dfbc38a436))

### Bug Fixes

- **tools:** Ship pptx-viewer-core as a dependency so npx installs it (by @ChristopherVR) ([da33db1](https://github.com/ChristopherVR/pptx-viewer/commit/da33db11281f3573dc49defaba7e7404e59bc43f))
- **deps:** Unblock install after the 1.1.23 version alignment (by @ChristopherVR) ([542a92d](https://github.com/ChristopherVR/pptx-viewer/commit/542a92dcafe2041e8b1c3cb4b371ef0353a470c9))

### Documentation

- Streamline npm READMEs and add badges, screenshots, demo links (by @ChristopherVR) ([92e980d](https://github.com/ChristopherVR/pptx-viewer/commit/92e980d434900abd223c4d70c6cae19a623f9ca8))
- **tools:** Make MCP first-class in README and drop em-dashes (by @ChristopherVR) ([89ebd64](https://github.com/ChristopherVR/pptx-viewer/commit/89ebd6453719cf46a4e655dfe689c9d5fae19549))

### Build & CI

- Add @pptx-viewer/tools to test, release, and publish pipeline (by @ChristopherVR) ([0e2ff95](https://github.com/ChristopherVR/pptx-viewer/commit/0e2ff9579a8ea039d4367d69f13998560ee9313d))
- Independent per-package versioning, tags, and changelogs (by @ChristopherVR) ([79595d9](https://github.com/ChristopherVR/pptx-viewer/commit/79595d972d7c4102e8b1e1e3926f439486f76ba1))

### Dependencies

- **deps:** Update all dependencies to latest (by @ChristopherVR) ([e3287c0](https://github.com/ChristopherVR/pptx-viewer/commit/e3287c03ff58b1a1ae103ed32a513468a454a084))
- **deps:** Bump all workspace manifest floors to latest (by @ChristopherVR) ([890c33d](https://github.com/ChristopherVR/pptx-viewer/commit/890c33d667a39480a69e6a3da893964382993b29))

### Chores

- **tools:** Bump @pptx-viewer/tools to v1.1.0 (by @ChristopherVR) ([c15aba6](https://github.com/ChristopherVR/pptx-viewer/commit/c15aba600c5f2a1137acb157b7dab896e659f37c))
- Rename package to pptx-viewer-mcp and publish to npm (by @ChristopherVR) ([9cb8a25](https://github.com/ChristopherVR/pptx-viewer/commit/9cb8a2567082b9bfdc91efee0b91cf2cbe2aa1c4))
- Bump all packages to 1.x.1 patch versions (by @ChristopherVR) ([c75205a](https://github.com/ChristopherVR/pptx-viewer/commit/c75205a96cc7797d1647ac4705395b7707ac8910))
- Bump all packages to minor versions for SDK table support (by @ChristopherVR) ([2d4b635](https://github.com/ChristopherVR/pptx-viewer/commit/2d4b6351b0bf328f8a556cf593733fd8ad36c7b5))
- Bump dependencies to latest and minor-bump packages for parity work (by @ChristopherVR) ([da19fdf](https://github.com/ChristopherVR/pptx-viewer/commit/da19fdf9a4670d274d9973b67aa22d34217b8555))
- Roll TypeScript back to 5.9.x; quiet new oxlint vitest rules (by @ChristopherVR) ([713c020](https://github.com/ChristopherVR/pptx-viewer/commit/713c020ac2428db0fb1eb6cb30e56b2cff19a80f))
- Relicense from MIT to Apache-2.0 (by @ChristopherVR) ([e12f926](https://github.com/ChristopherVR/pptx-viewer/commit/e12f9266f02bebbfc218986b617c418fee43a56b))

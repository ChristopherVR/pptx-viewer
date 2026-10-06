# pptx-viewer has moved to ooxml

**The PowerPoint viewer now lives in [ChristopherVR/ooxml](https://github.com/ChristopherVR/ooxml), under [`viewers/pptx`](https://github.com/ChristopherVR/ooxml/tree/main/viewers/pptx).** This repository no longer holds code and accepts no changes.

It moved into the same repository as the library it is built on (`ooxml-core`), the shared UI (`ooxml-ui`) and the Word, Excel, Visio and OpenTeams viewers, so one change can span the format logic and every viewer, and one CI and one release flow cover all of them.

## Where everything is now

| What                            | Now                                                                                                                                       |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Source code                     | [`viewers/pptx`](https://github.com/ChristopherVR/ooxml/tree/main/viewers/pptx) in ChristopherVR/ooxml                                    |
| Documentation and live demos    | [christophervr.github.io/ooxml/pptx](https://christophervr.github.io/ooxml/pptx/) (the old `christophervr.github.io/pptx-viewer/` links redirect there) |
| The Office suite launcher       | [christophervr.github.io/ooxml](https://christophervr.github.io/ooxml/)                                                                  |
| Issues and pull requests        | [ChristopherVR/ooxml/issues](https://github.com/ChristopherVR/ooxml/issues)                                                               |
| Releases and changelogs         | [ChristopherVR/ooxml/releases](https://github.com/ChristopherVR/ooxml/releases) and each package's `CHANGELOG.md` under `viewers/pptx`   |

## Nothing changes for users

- **The npm packages keep their names**: [`pptx-react-viewer`](https://www.npmjs.com/package/pptx-react-viewer), [`pptx-vue-viewer`](https://www.npmjs.com/package/pptx-vue-viewer), [`pptx-angular-viewer`](https://www.npmjs.com/package/pptx-angular-viewer), [`pptx-svelte-viewer`](https://www.npmjs.com/package/pptx-svelte-viewer), [`pptx-vanilla-viewer`](https://www.npmjs.com/package/pptx-vanilla-viewer), [`pptx-viewer-core`](https://www.npmjs.com/package/pptx-viewer-core), [`pptx-viewer-mcp`](https://www.npmjs.com/package/pptx-viewer-mcp) and [`@christophervr/pptx-viewer`](https://www.npmjs.com/package/@christophervr/pptx-viewer). New versions are published from ChristopherVR/ooxml and continue the existing version numbers, so `npm update` keeps working.
- **The full history moved with the code.** Every commit is in ChristopherVR/ooxml under `viewers/pptx`, and every release tag (`pptx-react-viewer@4.24.3` and so on) exists there too.
- Versions published before the move name this repository in their provenance; that stays true for them.

The licence files stay here because they cover the versions released from this repository. The code remains under the Apache License 2.0 in its new home.

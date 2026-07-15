# pptx-viewer-locales

Optional complete UI dictionaries for the pptx-viewer bindings.

![Independent French, Spanish, and German dictionaries mapping the viewer's canonical translation keys](https://raw.githubusercontent.com/ChristopherVR/pptx-viewer/main/.github/assets/packages/locales.svg)

```ts
import { translationsFr } from 'pptx-viewer-locales/fr';
import { translationsEs } from 'pptx-viewer-locales/es';
import { translationsDe } from 'pptx-viewer-locales/de';
```

Each dictionary contains every canonical English key. Locale packages are
separate entry points so applications only bundle the languages they use.

The initial expanded translations are machine-assisted drafts built on the
existing curated demo vocabulary. Exact key and interpolation-placeholder
coverage is tested; native-speaker terminology review is still welcome.

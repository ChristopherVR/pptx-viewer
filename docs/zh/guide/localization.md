---
title: 国际化
description: 了解 React、Vue 3、Angular、原生 JavaScript 和 Svelte 组件的界面翻译机制，以及如何为应用添加语言或贡献翻译。
---

# 国际化 {#localization-i18n}

**组件通过 `pptx.*` 翻译键查找所有界面文本，字典由宿主应用提供。** 每个组件包都包含英文。仓库还在私有的 `pptx-viewer-locales` 工作区维护完整的法语、西班牙语、德语和简体中文参考字典，用于演示应用和翻译质量检查。该工作区不发布到 npm。React、Vue 和 Angular 使用宿主框架的 i18n 库；Vanilla 和 Svelte 则提供轻量的内置翻译器：

| 组件    | 组件内部的翻译调用                                        | 宿主需要提供的库                                                                  |
| ------- | --------------------------------------------------------- | --------------------------------------------------------------------------------- |
| React   | `react-i18next` 的 `t(key, opts)`                         | [i18next](https://www.i18next.com/) / [react-i18next](https://react.i18next.com/) |
| Vue 3   | `vue-i18n` 的 `useI18n().t(key, opts)`                    | [vue-i18n](https://vue-i18n.intlify.dev/)                                         |
| Angular | `ngx-translate` 的 `translate()` signal / `TranslatePipe` | [@ngx-translate/core](https://github.com/ngx-translate/core)                      |
| Vanilla | 包内置的 `t(key, params)`                                 | 无需 i18n 库，直接传入 `messages` 字典                                            |
| Svelte  | 包内置的 `t(key, params)`                                 | 无需 i18n 库，调用 `registerTranslations(locale, dict)`                           |

这种设计遵循各框架生态的使用习惯。React、Vue 和 Angular 可以接入应用已有的 i18n 配置，Vanilla 和 Svelte 则无需额外依赖。

## 英文字典 {#the-english-dictionary}

每个包都重新导出可直接使用的英文资源，无需从头编写：

```ts
// React and Vue: subpath export
import { translationsEn, keyToLabel } from 'pptx-react-viewer/i18n'; // or 'pptx-vue-viewer/i18n'
```

```ts
// Angular: exported from the package root, not a subpath
import { translationsEn, keyToLabel } from 'pptx-angular-viewer';
```

```ts
// Vanilla: exported from the package root, like Angular
import { translationsEn, keyToLabel } from 'pptx-vanilla-viewer';
```

```ts
// Svelte: subpath export, like React/Vue
import { translationsEn, keyToLabel } from 'pptx-svelte-viewer/i18n';
```

`translationsEn` 是包含全部 `pptx.*` 键的扁平 `Record<string, string>`，例如 `'pptx.statusBar.allSaved': 'All saved'`。动态内容使用 `{{token}}` 插值占位符，例如 `'pptx.statusBar.slideOf': 'Slide {{current}} of {{total}}'`。i18n 库会使用传给 `t()` 或 `translate()` 的 `opts` 替换这些占位符。

未找到字典项时，`keyToLabel(key)` 会从键的最后一段生成可读名称，例如 `"pptx.slideSorter.zoomIn"` 变为 `"Zoom In"`。将它接入 i18n 库的缺失键处理器后，尚未翻译的文本也能显示可读回退内容，避免直接显示原始键名。

## 接入方式 {#wiring-it-up}

### React {#react}

```ts
// i18n.ts
import { createInstance } from 'i18next';
import { translationsEn, keyToLabel } from 'pptx-react-viewer/i18n';
import { initReactI18next } from 'react-i18next';

const i18nInstance = createInstance();
i18nInstance.use(initReactI18next).init({
	resources: { en: { translation: translationsEn } },
	lng: 'en',
	fallbackLng: 'en',
	interpolation: { escapeValue: false }, // React already escapes
	parseMissingKeyHandler: (key: string) => keyToLabel(key),
	missingKeyHandler: false,
});

export default i18nInstance;
```

```tsx
// app entry
import i18nInstance from './i18n';
import { I18nextProvider } from 'react-i18next';

<I18nextProvider i18n={i18nInstance}>
	<App />
</I18nextProvider>;
```

调用 `i18nInstance.changeLanguage('fr')` 切换语言。

### Vue 3 {#vue-3}

```ts
// i18n.ts
import { translationsEn, keyToLabel } from 'pptx-vue-viewer/i18n';
import { createI18n } from 'vue-i18n';

const i18n = createI18n({
	legacy: false,
	locale: 'en',
	fallbackLocale: 'en',
	messages: { en: translationsEn },
	missing: (_locale, key) => keyToLabel(key),
	missingWarn: false,
	fallbackWarn: false,
});

export default i18n;
```

```ts
// main.ts
import { createApp } from 'vue';
import App from './App.vue';
import i18n from './i18n';

createApp(App).use(i18n).mount('#app');
```

通过 `i18n.global.locale.value = 'fr'` 切换语言。

### Angular {#angular}

```ts
// i18n.ts
import { Injectable } from '@angular/core';
import type { MissingTranslationHandlerParams } from '@ngx-translate/core';
import { MissingTranslationHandler, provideTranslateService } from '@ngx-translate/core';
import { keyToLabel } from 'pptx-angular-viewer';

@Injectable()
class LabelFallbackMissingTranslationHandler implements MissingTranslationHandler {
	handle(params: MissingTranslationHandlerParams): string {
		return keyToLabel(params.key);
	}
}

export const i18nProviders = provideTranslateService({
	lang: 'en',
	fallbackLang: 'en',
	missingTranslationHandler: {
		provide: MissingTranslationHandler,
		useClass: LabelFallbackMissingTranslationHandler,
	},
});
```

```ts
// main.ts
bootstrapApplication(AppComponent, { providers: [i18nProviders] });
```

注册一次英文字典，通常在根组件中完成，然后通过 `TranslateService` 切换语言：

```ts
import { inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { translationsEn } from 'pptx-angular-viewer';

const translate = inject(TranslateService);
translate.setTranslation('en', translationsEn);
// later, to switch:
translate.use('fr');
```

::: tip 传入普通 `Provider` 对象，不要直接传入类
自定义 `MissingTranslationHandler` 时，请使用 `{ provide: MissingTranslationHandler, useClass: YourHandler }`，不要只传类引用。在某些构建工具链（使用标准装饰器的 Vite/Rolldown）中，ngx-translate 的 `isClass()` 判断可能在生产构建中误判，导致没有通过 `new` 就调用处理器，从而在启动时报错。
:::

### 原生 JavaScript {#vanilla}

Vanilla 组件没有框架级 i18n 接入点，因此自带轻量翻译器。直接向 `createPptxViewer` 传入以语言代码为键的 `messages` 字典即可，无需单独配置。

```ts
import { createPptxViewer } from 'pptx-vanilla-viewer';
import { translationsFr } from './translations/fr';

const viewer = createPptxViewer(document.querySelector('#host')!, {
	source: '/deck.pptx',
	locale: 'fr',
	messages: { fr: translationsFr },
});
```

`messages` 将每个语言代码映射到包含 `pptx.*` 覆盖项的扁平 `Record<string, string>`。无需列出所有键，也无需自行展开 `translationsEn`，缺失项始终回退到英文。运行时调用 `viewer.setLocale('fr')` 切换语言，组件会按新语言重建静态界面文本并重新渲染。

### Svelte {#svelte}

Svelte 没有指定统一的 i18n 运行时，因此组件从 `/i18n` 子路径导出 `registerTranslations`。启动时注册各语言字典，再通过 `locale` 属性传入当前语言。

```ts
// i18n.ts
import { registerTranslations } from 'pptx-svelte-viewer/i18n';
import { translationsFr } from './translations/fr';

registerTranslations('fr', translationsFr);
```

```svelte
<!-- App.svelte -->
<script lang="ts">
	import { PowerPointViewer } from 'pptx-svelte-viewer';
	import './i18n';

	let locale = $state('fr');
	let source = $state<Uint8Array>();
	// ...fetch/read the .pptx bytes into `source` however your app loads files
</script>

<PowerPointViewer {source} {locale} />
```

注册内容会与该语言已有内容合并，因此可以多次调用 `registerTranslations`，例如按功能区域分别注册，而不会覆盖之前的其他项。与 Vanilla 一样，尚未翻译的键始终回退到英文。

## 文件 > 选项 > 语言 {#file-options-language}

每个组件的设置对话框都提供**语言**选项卡，与[外观](/zh/guide/theming)选项卡相邻，供用户在运行时选择语言。这个选择器不会自行打包或加载翻译内容，只切换通过上述 i18n 配置**已经注册的语言**。未传入 `availableLocales` 时，各组件按以下方式读取已加载的语言：

| 组件    | 如何发现可用语言                                                     |
| ------- | -------------------------------------------------------------------- |
| React   | `react-i18next` 实例中的 `i18n.options.resources` / `i18n.languages` |
| Vue 3   | `useI18n().availableLocales`，即 `vue-i18n` 组合式函数的内置属性     |
| Angular | `TranslateService.getLangs()`                                        |
| Vanilla | 传给 `createPptxViewer` 的 `messages` 字典，以及 `'en'`              |
| Svelte  | 所有通过 `registerTranslations` 注册的语言                           |

例如，只注册了 `en` 和 `fr` 时，语言选项卡就只提供这两种语言，不会列出没有字典的选项。共享的 `LOCALE_CATALOG` 为已知代码提供英文、法语、西班牙语、德语和简体中文的显示名称；无法识别的代码直接显示原值。

其处理机制与外观选项卡相似：选择语言后，组件直接调用宿主 i18n 实例，例如 `i18n.changeLanguage`、`locale.value =` 或 `TranslateService.use`，立即应用并保存到 `localStorage` 的 `pptx-viewer-prefs`。如果传入 `onLocaleChange`，组件就只调用该回调，不再自行操作 i18n 实例，应用和持久化均由宿主负责。`defaultLocale`、`availableLocales` 和 `onLocaleChange` 的完整属性说明见[主题配置](/zh/guide/theming)。

## 简体中文 {#simplified-chinese}

演示应用的**文件 > 选项 > 语言**中提供**简体中文**（`zh-CN`）。参考字典与英文包含相同的翻译键和 `{{placeholders}}`。它翻译的是编辑器界面，不会翻译幻灯片中的文本。

外部应用可以将 `packages/locales/src/zh-CN/` 复制到自己的翻译目录，从其中的 `index.ts` 导入 `translationsZhCN`，再按上文的方式注册到所用组件：

| 组件    | 注册复制后的字典                                                           | 切换语言                             |
| ------- | -------------------------------------------------------------------------- | ------------------------------------ |
| React   | `i18n.addResourceBundle('zh-CN', 'translation', translationsZhCN)`         | `i18n.changeLanguage('zh-CN')`       |
| Vue     | `i18n.global.setLocaleMessage('zh-CN', toVueI18nSyntax(translationsZhCN))` | `i18n.global.locale.value = 'zh-CN'` |
| Angular | `translate.setTranslation('zh-CN', translationsZhCN)`                      | `translate.use('zh-CN')`             |
| Vanilla | 在组件选项中设置 `messages: { 'zh-CN': translationsZhCN }`                 | `viewer.setLocale('zh-CN')`          |
| Svelte  | `registerTranslations('zh-CN', translationsZhCN)`                          | 将组件的 `locale` 属性设为 `'zh-CN'` |

Vue 需要从 `pptx-vue-viewer/i18n` 导入 `toVueI18nSyntax`，将参考字典中的 `{{name}}` 占位符转换为 Vue 的 `{name}` 语法。应用注册字典后，语言选择器会识别 `zh-CN` 并显示**简体中文**。

## 在应用中添加其他语言 {#adding-a-language-in-your-app}

为组件添加语言无需修改本仓库。使用与 `translationsEn` 相同的键编写字典，再注册为所用 i18n 库的另一个资源或语言即可，例如 i18next 的 `resources.fr`、vue-i18n 的 `messages.fr`，或 ngx-translate 的 `translate.setTranslation('fr', ...)`。无需一开始就翻译全部键，未覆盖的内容可以通过 `keyToLabel` 回退，避免空白或原始键名。

如果希望在编译时发现缺失或拼错的键，而不是依赖运行时回退，请使用导出的 `TranslationKey` 联合类型约束字典，而非普通的 `Record<string, string>`：

```ts
import type { TranslationKey } from 'pptx-react-viewer/i18n'; // 'pptx-vue-viewer/i18n', or from 'pptx-angular-viewer' root for Angular

export const translationsFr: Record<TranslationKey, string> = {
	'pptx.statusBar.allSaved': 'Tout enregistré',
	// TypeScript errors if you miss a key, misspell one, or add one that doesn't exist
	...
};
```

五个演示应用均使用这种方式，完整示例见下文[在演示应用中体验](#try-it-in-the-demos)。

## 向项目贡献翻译 {#contributing-a-translation-upstream}

私有的 `packages/locales` 工作区维护完整的参考字典。每种语言按产品区域拆分为具名文件，例如 `charts.ts`、`presenting-and-slide-show.ts` 和 `text-and-equations.ts`。

母语使用者和熟练使用者可以按模块贡献，无需一次审阅整套字典：

1. 在 `packages/locales/src/fr`、`src/es`、`src/de` 或 `src/zh-CN` 下选择一个产品区域文件。
2. 将每个值与 `packages/shared/src/i18n/translations-en.ts` 中相同的键对照。
3. 改进译文，保持点分隔的键名以及全部 `{{token}}` 占位符不变。
4. 优先使用对应语言的 Microsoft PowerPoint 术语，尤其是 SmartArt、平滑切换、图表和母版视图。
5. 运行 `bun run --filter 'pptx-viewer-locales' test`、`typecheck` 和 `build`，并在 PR 中说明检查的语言和产品区域。

英文新增键后，`bun run locales:generate` 会读取已有语义文件并保留所有有效翻译，包括经过审阅、刻意与英文相同的值。它只填补缺失项或占位符无效的项，生成的新增译文应在提交前审阅。新键前缀未分配到具名分区时，生成器会报错。

添加另一种语言时，需要补充语言入口、生成器配置、根导出和测试用例。`packages/locales/src/locales.test.ts` 会检查键集合和插值占位符完全一致。

## 在演示应用中体验 {#try-it-in-the-demos}

[React](https://christophervr.github.io/pptx-viewer/demo/)、[Vue](https://christophervr.github.io/pptx-viewer/demo-vue/)、[Angular](https://christophervr.github.io/pptx-viewer/demo-angular/)、Vanilla 和 Svelte 演示应用都包含语言选择器，可以切换英文、法语、西班牙语、德语和简体中文。四种非英文字典均通过仓库的私有语言工作区覆盖全部标准界面键。

选择器的接入属于演示代码，字典通过 Bun 工作区从 `packages/locales` 引用：

- **React**：`demos/demo-react/i18n.ts`、`LanguagePicker.tsx`
- **Vue**：`demos/demo-vue/src/i18n.ts`、`LanguagePicker.vue`
- **Angular**：`demos/demo-angular/src/i18n.ts`、`language-picker.component.ts`
- **Vanilla**：`demos/demo-vanilla/src/demo-i18n.ts`、`language-picker.ts`
- **Svelte**：`demos/demo-svelte/src/demo-i18n.svelte.ts`、`LanguagePicker.svelte`

## 下一步 {#next-steps}

- [安装](/zh/guide/installation)：同级依赖，包括 `i18next` 和 `react-i18next`。
- [React Hooks](/zh/react/hooks)：如果需要在组件之外翻译文本，`t` 也会沿 hook 层传递。

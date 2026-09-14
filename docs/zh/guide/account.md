---
title: 账号与登录
description: 了解“文件 > 账号”的默认内容，以及如何通过默认关闭的接入点连接应用的登录流程。
---

# 账号与登录 {#account-sign-in}

“文件 > 账号”包含本地个人资料编辑、显示本地存储实时用量的“存储与隐私”面板、“关于”区域，以及可选的登录区域。只有宿主应用主动接入后，登录区域才会显示。

## 默认提供的功能 {#what-ships-by-default}

**个人资料。** 包含显示名称输入框和头像颜色选项。这些设置只影响界面显示，不会发送到任何服务器，而是与[主题配置](/zh/guide/theming)中的主题和语言回退设置一起保存在 `localStorage` 中，键名为 `pptx-viewer-prefs`。

**存储与隐私。** 显示本地自动保存或恢复快照对应的演示文稿数量及总大小，数据来自页面重载恢复流程使用的同一个 IndexedDB 存储。“清除本地数据”按钮在确认后会删除所有本地快照和持久化偏好设置。

**关于。** 显示当前框架组件的包名和版本。

**登录。** 默认不显示。只有传入 `accountAuth` 并设置 `enabled: true` 时才会显示，详见下文。

这些默认功能不需要额外配置，在未配置的独立组件和完成接入的宿主应用中行为一致。

## 接入实际登录流程 {#wiring-a-real-sign-in-flow}

组件不预设认证方案，不包含 OAuth 客户端、会话 Cookie 或后端认证请求。`accountAuth` 只是一个简单的接入点：启用后，“账号”页会显示登录提示，并回调宿主应用。登录状态由你的应用定义，再传回组件。

```ts
interface AccountAuthConfig {
	enabled: boolean;
	onSignIn: () => void;
	signedInUser?: {
		name: string;
		email?: string;
		avatarUrl?: string;
	};
}
```

- 默认情况下，`enabled` 为 `false`；不传入 `accountAuth` 时也是如此，登录区域完全不显示。
- 用户点击登录按钮时会触发 `onSignIn`。在这里启动应用的实际登录流程，例如跳转、OAuth 弹窗或自定义对话框。组件不会等待流程完成，也不会管理加载状态。
- 应用确认已登录用户后，在下一次渲染或更新时通过同一个 `accountAuth` 属性传入 `signedInUser`。“账号”页便会显示当前登录用户的名称，替换原先的登录按钮。

```tsx
// React
const [user, setUser] = useState<{ name: string; email?: string } | undefined>();

<PowerPointViewer
	content={bytes}
	accountAuth={{
		enabled: true,
		onSignIn: () => startOAuthFlow().then(setUser),
		signedInUser: user,
	}}
/>;
```

```vue
<!-- Vue -->
<PowerPointViewer
	:content="bytes"
	:accountAuth="{ enabled: true, onSignIn: startOAuthFlow, signedInUser: user }"
/>
```

```html
<!-- Angular -->
<pptx-viewer
	[content]="bytes"
	[accountAuth]="{ enabled: true, onSignIn: startOAuthFlow, signedInUser: user }"
/>
```

```ts
// Vanilla
const viewer = createPptxViewer(host, {
	source: bytes,
	accountAuth: { enabled: true, onSignIn: startOAuthFlow, signedInUser: user },
});
```

```svelte
<!-- Svelte -->
<PowerPointViewer source={content} accountAuth={{ enabled: true, onSignIn: startOAuthFlow, signedInUser: user }} />
```

五个框架组件使用相同的数据结构。

## 下一步 {#next-steps}

- [主题配置](/zh/guide/theming)：个人资料编辑器以及外观和语言选择器共用 `localStorage` 回退设置。
- [国际化](/zh/guide/localization)：“账号”页的所有文本均通过标准的 `pptx.account.*` 翻译键提供。

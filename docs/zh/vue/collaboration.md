---
title: 实时协作
description: 通过 Yjs CRDT 为 PowerPointViewer 提供多人实时协同编辑，包括 collaboration 属性、CollaborationConfig 结构、共享和广播对话框、在线状态及远程光标。
---

# 协作 {#collaboration}

`PowerPointViewer` 基于 **Yjs**（一种 CRDT）支持多人实时编辑，可使用 WebSocket 传输（`y-websocket`，需要服务器），也可使用无文档服务器的点对点传输（`y-webrtc`）。`CollaborationConfig` 类型和通信格式与 React、Angular 绑定共享（统一定义于 `pptx-viewer-shared`），因此三种绑定可以在同一房间内互操作。启用后会提供细粒度的 CRDT 文档同步（按幻灯片和元素）、实时远程光标、选区高亮、用户在线状态和跟随模式。单用户模式不会加载这些内容。

::: info 可选依赖
协作需要 `yjs`，以及所选传输方式对应的提供程序：`y-websocket`（基于服务器）或 `y-webrtc`（点对点）。不安装它们也能完整使用查看器，只是以单用户模式运行。需要协同编辑时再安装：

```bash
npm i yjs y-websocket   # server-based
npm i yjs y-webrtc      # serverless peer-to-peer
```

:::

## 通过 `collaboration` 属性启用 {#enabling-it-the-collaboration-prop}

将 `CollaborationConfig` 传入 `collaboration` 属性。提供配置后，查看器会在内部接入在线状态跟踪、远程光标和 CRDT 同步。

```vue
<script setup lang="ts">
import { PowerPointViewer } from 'pptx-vue-viewer';
import type { CollaborationConfig } from 'pptx-vue-viewer';

const config: CollaborationConfig = {
	roomId: 'my-room-123',
	serverUrl: 'wss://collab.example.com',
	userName: 'Alice',
	userColor: '#6366f1',
};
</script>

<template>
	<PowerPointViewer :content="bytes" can-edit :collaboration="config" />
</template>
```

## `CollaborationConfig` {#collaborationconfig}

```ts
type CollaborationRole = 'owner' | 'collaborator' | 'viewer';
type CollaborationTransport = 'websocket' | 'webrtc';

interface CollaborationConfig {
	/** Unique room id (alphanumeric, hyphens, underscores). */
	roomId: string;
	/** WebSocket URL for the Yjs provider, e.g. "wss://collab.example.com". Ignored for webrtc. */
	serverUrl: string;
	/** Transport - 'websocket' (default) or serverless 'webrtc'. */
	transport?: CollaborationTransport;
	/** WebRTC signaling server URLs (webrtc transport only). */
	signaling?: string[];
	/** Display name for the local user. */
	userName: string;
	/** Avatar URL for the local user (optional). */
	userAvatar?: string;
	/** Hex colour for the local user's cursor / presence indicator. */
	userColor?: string;
	/** Optional auth token sent with the WebSocket handshake / used as the webrtc room password. */
	authToken?: string;
	/** Session role - defaults to 'collaborator'. */
	role?: CollaborationRole;
	/** Elected-writer persistence: the 'owner' peer receives debounced PPTX snapshots. */
	onWriteBack?: (bytes: Uint8Array) => void;
	/** Debounce (ms) between the last change and onWriteBack. Default 5000. */
	writeBackDebounceMs?: number;
}
```

| 字段                  | 类型                     | 必填 | 说明                                                                |
| --------------------- | ------------------------ | ---- | ------------------------------------------------------------------- |
| `roomId`              | `string`                 | 是   | 会经过清理，建议仅使用字母、数字、`-` 和 `_`。                      |
| `serverUrl`           | `string`                 | 是   | `y-websocket` 服务器 URL；`transport: 'webrtc'` 时可以为 `''`。     |
| `transport`           | `CollaborationTransport` | 否   | 默认 `'websocket'`，也可选 `'webrtc'` 点对点模式。                  |
| `signaling`           | `string[]`               | 否   | y-webrtc 信令 URL，默认使用其公共列表。                             |
| `userName`            | `string`                 | 是   | 本地用户显示名称；未设置 `authorName` 时也用作批注和标记作者。      |
| `userAvatar`          | `string`                 | 否   | 经过校验的头像 URL。                                                |
| `userColor`           | `string`                 | 否   | 用户光标环的十六进制颜色。                                          |
| `authToken`           | `string`                 | 否   | WebSocket 握手参数或 WebRTC 房间密码。                              |
| `role`                | `CollaborationRole`      | 否   | `'owner'`、默认的 `'collaborator'` 或 `'viewer'`。                  |
| `onWriteBack`         | `(bytes) => void`        | 否   | 仅在 `'owner'` 端调用，提供防抖后的序列化 PPTX 快照，供持久化使用。 |
| `writeBackDebounceMs` | `number`                 | 否   | 默认 5000 ms。                                                      |

### 无需文档服务器的点对点模式 {#serverless-peer-to-peer-mode}

使用 `transport: 'webrtc'` 时无需文档服务器：参与者通过 WebRTC 直接交换更新，**同一浏览器**中的标签页甚至可以在完全断网时通过 BroadcastChannel 连接。托管在 GitHub Pages 上的演示就采用这种方式。跨设备会话通过 WebRTC 信令服务器建立连接（仅交换元数据，文档数据不会经过信令服务器）；生产环境请通过 `signaling` 指定自己的服务器。在内置共享或广播对话框中，将服务器 URL 留空即可选择此传输方式。

::: warning 输入会经过清理
房间 ID、用户名、头像 URL、光标位置和在线状态数据都会经过协作层的输入清理。建议 `roomId` 仅使用字母、数字、连字符和下划线，避免意外变化。
:::

## 控制会话：共享与广播对话框 {#controlling-sessions-share-and-broadcast-dialogs}

协作状态由宿主应用**控制**。查看器的共享对话框通过事件表达用户意图，应用据此切换 `collaboration` 属性。

| 事件                   | 载荷                          | 用途                                                              |
| ---------------------- | ----------------------------- | ----------------------------------------------------------------- |
| `@start-collaboration` | `config: CollaborationConfig` | 用户从共享对话框启动了会话，请用此配置设置 `collaboration` 属性。 |
| `@stop-collaboration`  | -                             | 用户停止了会话，请清空 `collaboration` 属性。                     |

`shareDefaults`（`{ roomId?; userName?; serverUrl? }`）用于预填共享对话框字段；省略时为空。

```vue
<script setup lang="ts">
import { PowerPointViewer } from 'pptx-vue-viewer';
import type { CollaborationConfig } from 'pptx-vue-viewer';
import { ref } from 'vue';

const content = defineProps<{ content: Uint8Array }>();
const collab = ref<CollaborationConfig>();
</script>

<template>
	<PowerPointViewer
		:content="content"
		can-edit
		:collaboration="collab"
		:share-defaults="{ serverUrl: 'wss://collab.example.com', userName: 'Alice' }"
		@start-collaboration="collab = $event"
		@stop-collaboration="collab = undefined"
	/>
</template>
```

查看器还提供独立的**广播**流程，用于观众单向跟随演示者的会话：演示者以 `role: 'owner'` 加入，观众通过共享的 `broadcasterSlideIndex` 自动跟随演示者当前的幻灯片。它使用相同的底层 `useCollaboration` 会话，但由独立的对话框状态（内部 `useCollaborationWiring` 组合式函数）驱动，没有新增公开属性，而是复用 `@start-collaboration` / `@stop-collaboration`。

## 在线状态和远程光标 {#presence-and-remote-cursors}

会话处于活动状态时，查看器在幻灯片画布上渲染远程光标（标有用户名和颜色），并跟踪连接用户的状态（连接中、已连接、已断开、错误）。在线状态通过 Yjs 的 _awareness_ 广播：每位参与者发布一条记录，包含客户端 ID、姓名、颜色、当前幻灯片索引、限制在有效范围内的光标 X/Y 坐标、选中元素 ID、角色和最后更新时间戳，用于驱动光标界面。

## 自定义协作界面 {#building-custom-collaboration-ui}

```ts
import {
	CollaborationCursors,
	CollaborationStatusIndicator,
	FollowModeBar,
	RemoteSelectionOverlay,
	useCollaboration,
} from 'pptx-vue-viewer/viewer';
```

这些稳定导出提供了与 React 协作 Hook 和在线状态界面对应的 Vue 实现。需要自行组合会话时可使用 `useCollaboration`；展示组件接受它返回的响应式在线状态数据。完整查看器的共享和广播生命周期属于内部实现（`pptx-vue-viewer/internals` 中的 `useCollaborationWiring`），不受语义化版本兼容承诺保障。

## 服务器端 {#server-side}

使用默认 `websocket` 传输时，需要运行与 `y-websocket` 兼容的中继服务器，并能通过 `serverUrl` 访问。由于通信格式相同，React 和 Angular 演示使用的参考服务器也适用于此：

- **`demos/collab-server.example.mjs`**：无需新增依赖的 Bun 服务器（使用仓库已有的 `yjs` / `y-protocols` / `lib0`）。认证有两种模式，均在 WebSocket 握手时验证，失败会在协议升级前返回 401：JWT 模式（适合生产环境，使用 `COLLAB_AUTH_JWT_SECRET` 和短期 HS256 令牌，服务器强制校验 `exp`、`room`、`sub`、`role` 声明），以及允许列表模式（`COLLAB_AUTH_TOKENS=a,b,c`，用于开发）。`role: 'viewer'` 令牌得到只读连接，中继会丢弃其文档写入。每个房间的 Y.Doc 会快照保存到 `COLLAB_DATA_DIR`，下次加入时恢复。

  ```bash
  COLLAB_AUTH_JWT_SECRET=change-me bun demos/collab-server.example.mjs
  ```

- **`demos/collab-server-hocuspocus.example.mjs`**：在 Node/Hocuspocus 技术栈上实现相同约定，通过 `@hocuspocus/extension-sqlite` 使用 SQLite 持久化。

两种服务器都会验证各绑定发送的令牌：`CollaborationConfig` 中的 `authToken` 会成为 WebSocket 握手的 `?token=` 查询参数。生产环境应在中继前终止 TLS（使用 `wss://`），并优先选择有效期较短的 JWT 模式。令牌通过 URL 查询参数传递，因此应保持短期有效，并避免上游记录请求 URL。

`transport: 'webrtc'` 不需要文档服务器。

[MCP 包](/zh/packages/mcp)提供自己的服务端 Yjs 编解码器，但其 Y.Doc 键布局与预览组件的同步 schema 不同，两者不能共用一个 Y.Doc。

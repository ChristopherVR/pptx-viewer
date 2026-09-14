---
title: Svelte 查看器实时协作
description: 通过 Yjs CRDT 为 Svelte PowerPointViewer 提供多人实时协同编辑，包括 collaboration 属性、CollaborationConfig 结构、共享和广播对话框、在线状态及远程光标。
---

# 协作 {#collaboration}

`<PowerPointViewer>` 基于 **Yjs**（一种 CRDT）支持多人实时编辑，可使用 WebSocket 传输（`y-websocket`，需要服务器），也可使用无文档服务器的点对点传输（`y-webrtc`）。`CollaborationConfig` 类型和通信格式与 React、Vue、Angular 和原生 JavaScript 绑定共享，统一定义于共享层，因此所有绑定可以在同一房间内互操作。启用后，查看器连接房间，按幻灯片和元素细粒度发布本地编辑，应用远程参与者的编辑，并渲染实时远程光标、选区高亮和用户在线状态。单用户模式不会加载这些内容。

::: info 可选依赖
协作需要 `yjs` 和所选传输方式对应的提供程序，两者都只在会话启动时通过动态导入加载：

```bash
npm i yjs y-websocket   # server-based
npm i yjs y-webrtc      # serverless peer-to-peer
```

:::

## 通过 `collaboration` 属性启用 {#enabling-it-the-collaboration-prop}

将 `CollaborationConfig` 传入 `collaboration` 属性。清空它（设置为 `undefined`）会结束会话。`viewer` 角色使本地用户处于只读状态。

```svelte
<script lang="ts">
	import { PowerPointViewer, type CollaborationConfig } from 'pptx-svelte-viewer';

	let { bytes }: { bytes: Uint8Array } = $props();

	const config: CollaborationConfig = {
		roomId: 'my-room-123',
		serverUrl: 'wss://collab.example.com',
		userName: 'Alice',
		userColor: '#6366f1',
	};
</script>

<PowerPointViewer source={bytes} editable collaboration={config} />
```

## `CollaborationConfig` {#collaborationconfig}

| 字段                  | 类型                          | 必填 | 说明                                                                  |
| --------------------- | ----------------------------- | ---- | --------------------------------------------------------------------- |
| `roomId`              | `string`                      | 是   | 房间标识符，建议只使用字母、数字、连字符和下划线。                    |
| `serverUrl`           | `string`                      | 是   | `y-websocket` 服务器 URL；`transport: 'webrtc'` 时可以为 `''`。       |
| `transport`           | `'websocket' \| 'webrtc'`     | 否   | 默认 `'websocket'`，也可选 `'webrtc'` 点对点模式。                    |
| `signaling`           | `string[]`                    | 否   | y-webrtc 信令 URL，默认使用其公共列表。                               |
| `userName`            | `string`                      | 是   | 本地用户的显示名称。                                                  |
| `userAvatar`          | `string`                      | 否   | 本地用户的头像 URL。                                                  |
| `userColor`           | `string`                      | 否   | 用户光标和在线状态指示器的十六进制颜色。                              |
| `authToken`           | `string`                      | 否   | 随 WebSocket 握手发送，或用作 webrtc 房间密码。                       |
| `role`                | `CollaborationRole`           | 否   | `'owner'`、`'collaborator'`（默认）或 `'viewer'`（只读）。            |
| `sessionIntent`       | `'create' \| 'join'`          | 否   | 此客户端创建还是加入了房间，宿主可据此避免在加入时发布本地字节。      |
| `onWriteBack`         | `(bytes: Uint8Array) => void` | 否   | 选定写入者持久化：只有 `'owner'` 参与者收到带防抖的序列化 PPTX 快照。 |
| `writeBackDebounceMs` | `number`                      | 否   | 最后一次变化与 `onWriteBack` 之间的防抖时间，默认 5000 毫秒。         |

### 无需文档服务器的点对点模式 {#serverless-peer-to-peer-mode}

使用 `transport: 'webrtc'` 时无需文档服务器：参与者通过 WebRTC 直接交换更新，**同一浏览器**中的标签页甚至可以在完全断网时通过 BroadcastChannel 连接。跨设备会话通过 WebRTC 信令服务器建立连接，只交换元数据，文档数据不会经过它们；生产环境请通过 `signaling` 指定自己的服务器。在内置共享或广播对话框中，将服务器 URL 留空即可选择此传输方式。

## 控制会话：共享与广播对话框 {#controlling-sessions-share-and-broadcast-dialogs}

协作状态由**宿主应用控制**。内置共享对话框，以及观众跟随演示者当前幻灯片的单向广播流程，通过回调表达用户意图；应用据此切换 `collaboration` 属性：

| 回调                   | 载荷                          | 用途                                                  |
| ---------------------- | ----------------------------- | ----------------------------------------------------- |
| `onstartcollaboration` | `config: CollaborationConfig` | 用户启动了会话，请用此配置设置 `collaboration` 属性。 |
| `onstopcollaboration`  | -                             | 用户停止了会话，请清空 `collaboration` 属性。         |

`shareDefaults`（`{ roomId?, userName?, serverUrl? }`）预填共享对话框表单；广播对话框复用其中的 `serverUrl`。用户仍可编辑每个字段。

```svelte
<script lang="ts">
	import { PowerPointViewer, type CollaborationConfig } from 'pptx-svelte-viewer';

	let { bytes }: { bytes: Uint8Array } = $props();
	let collab = $state<CollaborationConfig | undefined>();
</script>

<PowerPointViewer
	source={bytes}
	editable
	collaboration={collab}
	shareDefaults={{ serverUrl: 'wss://collab.example.com', userName: 'Alice' }}
	onstartcollaboration={(config) => (collab = config)}
	onstopcollaboration={() => (collab = undefined)}
/>
```

::: tip 隐藏入口
只读嵌入场景如果不需要协作界面，可用 `hiddenActions={['share', 'broadcast']}` 隐藏工具栏按钮。参见[组件属性](/zh/svelte/props#hiddenactions-values)。
:::

## 在线状态和远程光标 {#presence-and-remote-cursors}

会话处于活动状态时，查看器在幻灯片画布上渲染远程光标，标有各用户姓名和颜色，并高亮远程选区、显示连接状态指示器及跟随模式栏。在线状态通过 Yjs 的 _awareness_ 传递：每位参与者发布一条记录，包含姓名、颜色、当前幻灯片、光标位置、选中元素和角色，用于驱动光标界面。

::: warning 输入会经过清理
房间 ID、用户名、头像 URL、光标位置和在线状态数据都会经过协作层的输入清理。建议 `roomId` 仅使用字母、数字、连字符和下划线，避免意外变化。
:::

## 服务器端 {#server-side}

使用默认 `websocket` 传输时，需要能通过 `serverUrl` 访问的 `y-websocket` 兼容中继。由于各绑定共享通信格式，仓库中的参考服务器无需修改即可使用：`demos/collab-server.example.mjs` 是无需新增依赖的 Bun 中继，支持 JWT 或令牌允许列表认证及按房间持久化；`demos/collab-server-hocuspocus.example.mjs` 在 Node/Hocuspocus 上实现相同约定，并使用 SQLite 持久化。完整服务器配置及认证细节请参见 [Vue 协作页面](/zh/vue/collaboration#server-side)，其中全部说明均适用于此绑定。

`transport: 'webrtc'` 不需要文档服务器。

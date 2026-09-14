---
title: 协作
description: 使用 Yjs CRDT 为 PowerPointViewer 接入实时多人编辑，了解 collaboration 属性、CollaborationConfig、在线状态和远程光标。
---

# 协作 {#collaboration}

`PowerPointViewer` 基于 **Yjs CRDT** 支持实时多人编辑，可使用需要服务器的 `y-websocket`，或无需文档服务器的 `y-webrtc` 点对点传输。启用后，提供幻灯片、元素和字段级的细粒度同步，以及远程光标、选中高亮、在线状态、头像和跟随模式。单用户模式不会加载这些功能。

::: info 可选依赖
协作需要 `yjs`，以及所选传输对应的 `y-websocket` 或 `y-webrtc`。没有这些依赖时，预览器仍可正常以单用户模式运行，仅在需要共同编辑时安装：

```bash
npm i yjs y-websocket   # server-based
npm i yjs y-webrtc      # serverless peer-to-peer
```

:::

## 通过 `collaboration` 属性启用 {#enabling-it-the-collaboration-prop}

向 `collaboration` 传入 `CollaborationConfig` 后，组件会通过协作 Provider 包裹内容，并接入在线状态、远程光标和 CRDT 同步。

```tsx
import { PowerPointViewer } from 'pptx-react-viewer';
import type { CollaborationConfig } from 'pptx-react-viewer/viewer';

const config: CollaborationConfig = {
	roomId: 'my-room-123',
	serverUrl: 'wss://collab.example.com',
	userName: 'Alice',
	userColor: '#6366f1',
};

<PowerPointViewer content={bytes} canEdit collaboration={config} />;
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
| `serverUrl`           | `string`                 | 是   | `y-websocket` 服务器 URL；当 `transport: 'webrtc'` 时可为 `''`。    |
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

设置 `transport: 'webrtc'` 后，参与者通过 WebRTC 直接交换更新，不需要文档服务器。**同一浏览器**的标签页通过 BroadcastChannel 连接，即使没有网络也可使用。GitHub Pages 演示采用这种方式。跨设备会话通过 WebRTC 信令服务器发现彼此，信令只传元数据，不经过文档内容；生产环境可以通过 `signaling` 指定自己的服务。内置共享和广播对话框中，服务器地址留空会选择此传输。

::: warning 输入会经过清理
协作层会清理房间 ID、用户名、头像 URL、光标位置和在线状态数据。`roomId` 建议只使用字母、数字、连字符和下划线。
:::

## 通过共享对话框控制会话 {#controlling-sessions-share-dialog-props}

协作状态由**宿主应用控制**。共享对话框只报告用户意图，宿主随后更新 `collaboration` 属性。

| 属性                   | 类型                                    | 用途                                                 |
| ---------------------- | --------------------------------------- | ---------------------------------------------------- |
| `onStartCollaboration` | `(config: CollaborationConfig) => void` | 用户创建会话后，使用返回的配置设置 `collaboration`。 |
| `onStopCollaboration`  | `() => void`                            | 用户停止会话后，清空 `collaboration`。               |
| `shareDefaults`        | `{ roomId?; userName?; serverUrl? }`    | 预填共享对话框，省略时为空。                         |

```tsx
function CollaborativeEditor({ content }: { content: Uint8Array }) {
	const [collab, setCollab] = useState<CollaborationConfig | undefined>();

	return (
		<PowerPointViewer
			content={content}
			canEdit
			collaboration={collab}
			shareDefaults={{ serverUrl: 'wss://collab.example.com', userName: 'Alice' }}
			onStartCollaboration={setCollab}
			onStopCollaboration={() => setCollab(undefined)}
		/>
	);
}
```

## 在线状态和远程光标 {#presence-and-remote-cursors}

会话期间，组件显示：

- 幻灯片画布上的**远程光标**，带对应用户名和颜色。
- 已连接用户的**在线状态和头像**，包括正在连接、已连接、已断开和错误状态。

在线状态通过 Yjs 的 awareness 广播。每个参与者发布 `UserPresence` 记录，包含客户端 ID、名称、颜色、当前幻灯片索引、经过范围限制的光标 X/Y、选中元素 ID、角色和更新时间，驱动光标和头像界面。

## 自定义协作界面 {#building-custom-collaboration-ui}

需要自行驱动同步或渲染在线状态时，可以从 `pptx-react-viewer/viewer` 导入按需使用、支持 tree-shaking 的协作 hooks 和组件：

```tsx
import {
	useYjsProvider,
	usePresenceTracking,
	useCollaborativeState,
	useCollaborativeHistory,
	CollaborationProvider,
	RemoteUserCursors,
	UserAvatarBar,
	CollaborationStatusIndicator,
} from 'pptx-react-viewer/viewer';
import type {
	CollaborationConfig,
	CollaborationContextValue,
	UserPresence,
	ConnectionStatus,
	CollaborationRole,
} from 'pptx-react-viewer/viewer';
```

接口说明见 [Hooks 中的协作 hooks](/zh/react/hooks#collaboration-hooks)。

## 服务器端 {#server-side}

默认的 `websocket` 模式需要运行兼容 `y-websocket` 的中继服务，并确保 `serverUrl` 可访问。`demos/` 提供两个参考服务器：

- **`demos/collab-server.example.mjs`**：无需额外依赖的 Bun 服务器，使用仓库已有的 `yjs`、`y-protocols` 和 `lib0`。两种认证模式都在 WebSocket 握手阶段校验，升级前以 401 拒绝无效请求：

  - **JWT 模式**，适合生产：设置 `COLLAB_AUTH_JWT_SECRET`，由应用服务器签发短期 HS256 token。示例文件头部提供基于一次 `createHmac` 调用的签发片段。
  - 中继校验 `exp`、`room`（仅允许访问对应房间）、`sub`（用户 ID）和 `role`。`role: 'viewer'` 获得**只读连接**，中继丢弃其文档写入，在服务端落实只读约束，而非信任客户端的 `canEdit`。
  - **白名单模式**，适合开发：通过 `COLLAB_AUTH_TOKENS=a,b,c` 设置静态 token。

  文件持久化会将各房间 Y.Doc 快照保存到 `COLLAB_DATA_DIR`，采用防抖并在最后一个连接断开时保存，下次加入时恢复，因此服务器重启后文档仍保留。

  ```bash
  COLLAB_AUTH_JWT_SECRET=change-me bun demos/collab-server.example.mjs
  ```

- **`demos/collab-server-hocuspocus.example.mjs`**：在 Node/Hocuspocus 上实现同样的约定，使用 `@hocuspocus/extension-sqlite` 持久化，也可利用其 Redis 扩展、webhook 和数据库存储生态。普通 y-websocket 客户端不会触发 Hocuspocus 的 `onAuthenticate`，因此示例改为在 `onConnect` 校验请求的 `?token=` 参数。

两个服务器均校验各组件发送的 token：`CollaborationConfig.authToken` 会成为 WebSocket 握手中的 `?token=` 查询参数。生产环境应在中继前终止 TLS，使用 `wss://`，并优先采用短有效期 JWT。由于 token 位于 URL 查询中，应避免上游记录请求 URL。

`transport: 'webrtc'` 不需要文档服务器。

[MCP 包](/zh/packages/mcp)提供自己的服务端 Yjs 编解码器，但其 Y.Doc 键布局与预览组件的同步 schema 不同，两者不能共用一个 Y.Doc。

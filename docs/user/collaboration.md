---
title: Collaboration
description: Co-edit a presentation in real time - live cursors, presence, and simultaneous edits.
---

# Collaboration

pptx-viewer supports **real-time co-editing**: several people can open the same presentation at once and see each other's changes live.

::: info Optional and developer-configured
Collaboration is an optional feature. It only works when the app you are using has been set up to connect to a collaboration session (a "room" on a collaboration server). If you don't see any collaboration controls, your app isn't configured for it. Developers: see [/react/collaboration](/react/collaboration) and the [MCP & Tools](/packages/mcp) docs.
:::

## What collaboration feels like

When you join a shared session:

- **Live presence** - A bar of colour-coded **avatars** shows who else is in the session right now.
- **Remote cursors** - You can see other people's cursors moving on the slide canvas, each labelled with their name and colour.
- **Simultaneous edits** - When someone moves a shape, edits text, or changes a slide, you see it update in near real time. Your own edits appear for everyone else the same way.
- **Connection status** - An indicator shows whether you are **connected**, **syncing**, or **disconnected** from the session.

Edits are merged automatically, so two people working on different parts of the deck won't overwrite each other.

## Joining a session

Exactly how you join depends on your app's setup. Common patterns:

- The app **joins automatically** when it loads (the room is configured ahead of time).
- The app provides a **Share** dialog where you enter or confirm a **room name**, your **display name**, and a **server address**, then connect.
- You open a **link** that already contains the room details.

Once connected, anyone else in the same room is collaborating with you on the same presentation.

::: tip No server? Peer-to-peer mode
In the Share and Broadcast dialogs you can leave the **server address empty** to start a
**peer-to-peer** session. Browser tabs on the same device always find each other; people on other
devices connect directly to you through public WebRTC signaling servers. The hosted demo runs
this way - try opening the same room in two tabs.
:::

## Presence and identity

- Your **display name** identifies you to others (it appears on your cursor and avatar). If you didn't set one, the app uses a default.
- Each participant is assigned a **colour** so cursors and avatars are easy to tell apart.

## Tips for smooth collaboration

- Communicate which slide or section each person is working on to avoid surprises.
- Watch the **connection status** - if it shows disconnected, your recent changes may not be syncing until you reconnect.
- Comments (see [Editing → Comments](/user/editing#comments)) are a good way to leave asynchronous feedback alongside live editing.

## For developers

Setting up rooms, a collaboration server, and presence is a developer task. See:

- [React Viewer → Collaboration](/react/collaboration) - wiring up Yjs-based co-editing.
- [MCP & Tools](/packages/mcp) - automation and tooling.

## Next

- [Editing Slides](/user/editing)
- [Keyboard Shortcuts](/user/shortcuts)

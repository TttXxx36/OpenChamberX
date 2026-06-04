# CodeGraph Architecture Index

This document is a navigational index for the OpenChamber codebase. It was seeded from the local CodeGraph index plus the repository's existing module documentation.

## CodeGraph Index

- Project: `D:\Documents\Opencode\OpenChamberX`
- Index directory: `.codegraph/`
- Indexed files: 1,104
- Nodes: 17,730
- Edges: 41,598
- Database size: 46.86 MB
- Backend: `node:sqlite`
- Languages: TypeScript, TSX, JavaScript, YAML, Rust

Common commands:

```bash
codegraph status .
codegraph sync .
codegraph files --path . --format tree --max-depth 3 --no-metadata
codegraph query --path . --limit 20 SyncProvider
codegraph context --path . --max-nodes 80 --max-code 0 "summarize OpenChamber architecture"
```

Use `codegraph sync .` after code changes. Use `codegraph index --force .` when the index looks stale or after large refactors.

## System Shape

OpenChamber is a Bun workspace monorepo that provides multiple runtimes for interacting with an OpenCode server:

- `packages/ui`: shared React UI and client-side sync/state layer.
- `packages/web`: Vite web app plus Express server and CLI package.
- `packages/electron`: primary desktop shell. Boots the web server in-process and loads the UI over loopback or packaged assets.
- `packages/vscode`: VS Code extension host plus webview runtime.
- `packages/desktop`: legacy Tauri shell, kept for migration/update compatibility.

High-level runtime flow:

```text
Electron / Web / VS Code runtime
        |
        v
RuntimeAPIs implementation
        |
        v
Shared React UI (`packages/ui`)
        |
        v
OpenCode SDK client + OpenChamber runtime APIs
        |
        v
Web server (`packages/web/server`) and/or external OpenCode server
```

## Package Index

### `packages/ui`

Purpose: shared React UI, sync layer, Zustand stores, runtime API contracts, and feature components.

Primary entrypoints:

- `packages/ui/src/main.tsx`: legacy/browser UI bootstrap. Reads `window.__OPENCHAMBER_RUNTIME_APIS__`, initializes locale/theme/persistence, renders `App`.
- `packages/ui/src/App.tsx`: app shell composition. Registers runtime APIs, mounts `SyncProvider`, routes views, handles desktop boot states and embedded session chat.
- `packages/ui/src/apps/*`: runtime-specific app renderers for VS Code, mobile, and Electron mini chat.

Core directories:

- `src/sync`: directory-scoped live data stores, SSE/WS event handling, session materialization, optimistic updates, and hooks like `useSessionMessageRecords`.
- `src/stores`: UI and persisted Zustand stores.
- `src/components/chat`: chat surface, input, message list, turn timeline, permissions/questions, scroll behavior.
- `src/components/chat/message/parts`: text, reasoning, tool, and activity part renderers.
- `src/components/session/sidebar`: session sidebar grouping, ordering, and item rendering.
- `src/lib/api/types.ts`: `RuntimeAPIs` contract shared by web, VS Code, and desktop runtime layers.
- `src/lib/opencode/client.ts`: OpenCode SDK client wrapper.
- `src/lib/runtime-fetch.ts`, `src/lib/runtime-url.ts`, `src/lib/runtime-auth.ts`: runtime transport and URL/auth helpers.

Important symbols to query:

```bash
codegraph query --path . SyncProvider
codegraph query --path . createEventPipeline
codegraph query --path . useSessionMessageRecords
codegraph query --path . RuntimeAPIs
codegraph query --path . ChatContainer
```

Module docs:

- `packages/ui/src/sync/DOCUMENTATION.md`
- `packages/ui/src/stores/DOCUMENTATION.md`
- `packages/ui/src/components/session/sidebar/DOCUMENTATION.md`
- `packages/ui/src/components/chat/message/parts/DOCUMENTATION.md`

### `packages/web`

Purpose: published web runtime package containing the web UI build, Express server, and `openchamber` CLI.

Primary entrypoints:

- `packages/web/src/main.tsx`: web runtime bootstrap.
- `packages/web/src/api/index.ts`: `createWebAPIs`, the web implementation of `RuntimeAPIs`.
- `packages/web/server/index.js`: Express server orchestration and OpenCode lifecycle integration.
- `packages/web/bin/cli.js`: package CLI entrypoint.

Server module map:

- `server/lib/opencode`: OpenCode lifecycle, config, auth, feature routes, bootstrap, startup, static routes.
- `server/lib/event-stream`: global UI events and message stream hubs/runtimes.
- `server/lib/fs`: filesystem routes, raw file access, search helpers.
- `server/lib/git`: Git service and routes.
- `server/lib/github`: GitHub OAuth/auth/status helpers.
- `server/lib/terminal`: terminal PTY runtime and streaming protocol helpers.
- `server/lib/notifications`: desktop/push notification preparation, routes, emitters.
- `server/lib/skills-catalog`: skill discovery/install/configuration routes.
- `server/lib/tunnels`: tunnel provider registry and managed/quick tunnel flows.
- `server/lib/ui-auth`: browser session auth, client tokens, passkeys/reset flows.

Important symbols to query:

```bash
codegraph query --path . createWebAPIs
codegraph query --path . createGlobalMessageStreamHub
codegraph query --path . createOpenCodeLifecycleRuntime
codegraph query --path . registerOpenChamberRoutes
codegraph query --path . createFeatureRoutesRuntime
```

Module docs are under `packages/web/server/lib/*/DOCUMENTATION.md`.

### `packages/electron`

Purpose: primary desktop runtime and packaging target.

Primary entrypoints:

- `packages/electron/main.mjs`: Electron main process. Owns windows, tray/menu, deep links, updates, notifications, local IPC, SSH/tunnel management, and in-process web server boot.
- `packages/electron/preload.mjs`: preload bridge exposing the compatibility/runtime surface to the renderer.
- `packages/electron/ssh-manager.mjs`: SSH/tunnel support.

Architecture rule: new desktop shell work goes here. Backend/domain features should stay in `packages/web/server` unless the capability is inherently native.

Important symbols to query:

```bash
codegraph query --path . startWebUiServer
codegraph query --path . BrowserWindow
codegraph query --path . ElectronSshManager
```

### `packages/vscode`

Purpose: VS Code extension host and webview runtime.

Primary entrypoints:

- `packages/vscode/src/extension.ts`: VS Code extension activation and command registration.
- `packages/vscode/src/ChatViewProvider.ts`: sidebar webview provider.
- `packages/vscode/src/opencode/*`: OpenCode manager/runtime integration.
- `packages/vscode/webview/main.tsx`: VS Code webview bootstrap.
- `packages/vscode/webview/api/index.ts`: `createVSCodeAPIs`, the VS Code implementation of `RuntimeAPIs`.

Important symbols to query:

```bash
codegraph query --path . activate
codegraph query --path . ChatViewProvider
codegraph query --path . createVSCodeAPIs
codegraph query --path . createOpenCodeManager
```

Module docs:

- `packages/vscode/src/DOCUMENTATION.md`

### `packages/desktop`

Purpose: legacy Tauri desktop shell, retained for migration/update compatibility.

Primary entrypoints:

- `packages/desktop/src-tauri/src/main.rs`
- `packages/desktop/scripts/build-sidecar.mjs`

Rule: do not add new features here unless the change is explicitly for currently released Tauri users.

## Key Cross-Cutting Flows

### Runtime API Flow

`RuntimeAPIs` is the shared contract between runtime shells and the React UI.

```text
packages/ui/src/lib/api/types.ts
        ^
        |
web:    packages/web/src/api/index.ts -> createWebAPIs
vscode: packages/vscode/webview/api/index.ts -> createVSCodeAPIs
desktop/electron: runtime/preload/web server integration supplies compatible APIs
        |
        v
packages/ui/src/contexts/RuntimeAPIProvider.tsx
packages/ui/src/hooks/useRuntimeAPIs.ts
```

When changing a runtime capability, update the contract first, then keep web, Electron, and VS Code parity visible in code.

### Sync and Message Rendering Flow

```text
OpenCode SSE/WS events
        |
        v
packages/ui/src/sync/event-pipeline.ts
        |
        v
packages/ui/src/sync/sync-context.tsx
        |
        v
packages/ui/src/sync/event-reducer.ts
        |
        v
directory child store: session/message/part/status/question/permission
        |
        v
useSessionMessageRecords / useSessionStatus / useDirectorySync
        |
        v
ChatContainer -> MessageList -> MessageBody -> message parts
```

Critical rule: reducer updates must preserve references for untouched store slices, but must create new references for changed arrays/objects that selectors depend on.

### Chat UI Flow

```text
ChatView
  -> ChatContainer
    -> useSessionMessageRecords
    -> useChatTimelineController
    -> MessageList
      -> MessageBody
        -> UserTextPart / AssistantTextPart / ReasoningPart / ToolPart / ProgressiveGroup
```

Start in `ChatContainer.tsx` for session-level behavior, `MessageList.tsx` for row behavior, and `message/parts/*` for rendered content.

### Web Server Flow

```text
openchamber CLI / Electron in-process boot
        |
        v
packages/web/server/index.js
        |
        v
OpenCode lifecycle runtime + Express routes + static UI
        |
        v
OpenCode SDK/server, filesystem, git, terminal, notification, tunnel, auth modules
```

`packages/web/server/index.js` is an orchestration entrypoint. Prefer changing focused modules in `server/lib/*` rather than adding more domain logic to the entrypoint.

### Electron Desktop Flow

```text
Electron main process
        |
        v
start web server in same Node process via @openchamber/web/server/index.js
        |
        v
load UI from loopback or packaged web assets
        |
        v
preload/runtime bridge + shared UI
```

Desktop-native ownership belongs in Electron; shared backend/domain behavior belongs in `packages/web/server`.

### VS Code Flow

```text
VS Code activation
        |
        v
OpenCode manager + webview providers
        |
        v
webview bootstrap
        |
        v
createVSCodeAPIs -> shared UI
```

Keep VS Code bridge/runtime parity in mind when changing shared UI contracts or server-backed APIs.

## Where To Start For Common Tasks

- Chat rendering bug: `packages/ui/src/components/chat/ChatContainer.tsx`, `MessageList.tsx`, `message/MessageBody.tsx`, `src/sync/event-reducer.ts`, `src/sync/sync-context.tsx`.
- Streaming/SSE behavior: `packages/ui/src/sync/event-pipeline.ts`, `sync-context.tsx`, `packages/web/server/lib/event-stream`.
- Session state or optimistic updates: `packages/ui/src/sync/session-actions.ts`, `sync-context.tsx`, `optimistic.ts`, `materialization.ts`.
- Runtime API feature: `packages/ui/src/lib/api/types.ts`, then `packages/web/src/api/*`, `packages/vscode/webview/api/*`, and Electron/preload/server wiring if applicable.
- Server route or OpenCode lifecycle: `packages/web/server/index.js` for wiring, then focused files under `packages/web/server/lib/opencode` or the relevant `server/lib/*` module.
- Desktop shell behavior: `packages/electron/main.mjs`, `preload.mjs`, `ssh-manager.mjs`.
- VS Code command/webview behavior: `packages/vscode/src/extension.ts`, providers under `packages/vscode/src`, webview APIs under `packages/vscode/webview/api`.
- Settings UI: `packages/ui/src/components/views/SettingsView.tsx`, `components/sections/*`, `components/sections/shared`.
- Terminal behavior: UI under `packages/ui/src/components/terminal`, runtime API under `packages/web/src/api/terminal`, server runtime under `packages/web/server/lib/terminal`.

## Existing Documentation Map

- `AGENTS.md`: project architecture, rules, validation commands, and module documentation map.
- `docs/SYNC.md`, `docs/SYNC-README.md`: sync architecture notes.
- `docs/TAURI_TO_ELECTRON_CUTOVER.md`: desktop migration strategy.
- `docs/REVERSE_PROXY.md`: reverse proxy deployment.
- `docs/PREVIEW_REMOTE_RELAY.md`: remote preview relay.
- `docs/CUSTOM_THEMES.md`: theme customization.
- `packages/ui/src/sync/DOCUMENTATION.md`: sync store and event handling rules.
- `packages/ui/src/stores/DOCUMENTATION.md`: store ownership rules.
- `packages/ui/src/components/session/sidebar/DOCUMENTATION.md`: session sidebar behavior.
- `packages/ui/src/components/chat/message/parts/DOCUMENTATION.md`: message part rendering.
- `packages/web/server/lib/*/DOCUMENTATION.md`: server module ownership.
- `packages/vscode/src/DOCUMENTATION.md`: VS Code runtime notes.

## CodeGraph Query Recipes

Use these when starting a task:

```bash
# Find a symbol and likely owners
codegraph query --path . --limit 20 SomeSymbol

# Build task-specific context without code blocks
codegraph context --path . --max-nodes 80 --max-code 0 "fix chat final message not rendering"

# Inspect package file shape
codegraph files --path . --filter packages/ui/src/sync --format tree --max-depth 4 --no-metadata

# Check impact candidates after editing files
codegraph affected --path . packages/ui/src/sync/event-reducer.ts
```

If CodeGraph output is too narrow, pair it with targeted `Glob`/`Grep` searches and the module docs listed above.

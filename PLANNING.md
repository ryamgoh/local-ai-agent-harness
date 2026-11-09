# Local Agent Harness with Plugins: What to Build, How Hard It Is, and How to Get There

*Manus AI, 9 November 2026*

My recommendation is a TypeScript harness built as a **core with thin front-ends**, where the core has no capabilities of its own. Every tool, policy and command the agent gains comes from a plugin. A plugin is a folder with a `harness-plugin.json` manifest. Any part of a plugin that runs code is a separate process and speaks one of two language-neutral contracts. Tools use the Model Context Protocol (MCP) over stdio. Interception of the agent's own lifecycle uses Claude Code's JSON-in/JSON-out command-hook format, adopted as a compatible subset rather than invented. Ship a CLI first as the MVP, then add a local web UI served by the same core. Skip the desktop app.

The build difficulty is **moderate**. The protocol-heavy pieces already exist as maintained libraries: the official MCP SDKs and the Vercel AI SDK's tool loop. As part of this plan I wrote a feasibility spike that connects a Node host (about 80 lines), a Python plugin (50 lines), a guard hook (17 lines) and a mock-model agent loop. It worked on the first run (see `spike/` and section 7). Most of the real work is product surface: plugin lifecycle edge cases, config and secrets, hook semantics, consent screens, cross-platform process handling and the UI. A follow-up library audit ([LIBRARIES.md](LIBRARIES.md)) mapped every generic concern to a maintained package, and a second spike wired those packages together. What is left to write is product policy, about 4,500 lines. For one experienced TypeScript developer, I estimate the MVP CLI at about one and a half to two weeks (7 to 10 focused days). The full end-to-end product, with the web UI and hardening, comes to about four to six weeks (20 to 29 days).

This document covers the evaluation and the decisions. Four companion files turn it into work:

- [LIBRARIES.md](LIBRARIES.md) says which library does each job, what stays custom and why, and which traps to avoid.
- [SPEC.md](SPEC.md) holds the requirements and testable success criteria.
- [PROTOCOL-v1-draft.md](PROTOCOL-v1-draft.md) is the contract plugin developers would code against.
- [tasks/plan.md](tasks/plan.md) is the task-by-task implementation plan.

## 1. What the brief actually requires

The brief is short, but each clause implies a concrete, testable capability. Reading it literally is the best way to avoid building the wrong thing. The mapping below drives every later section.

| Brief says | What it has to mean in the product | Milestone |
|---|---|---|
| "install" | `harness plugin install <path\|git>` validates the manifest. It shows the exact commands and the declared permissions, asks for consent, copies the plugin into the harness home and records it in a registry | M1 (local path), M2 (git, npm, update) |
| "inspect" | `plugin list` and `plugin inspect` show metadata, source, version, permissions and config status (secrets masked). They also list the tools, hooks and commands the plugin contributes, plus its live health and log path | M1, M2 (logs) |
| "configure" | The plugin declares a JSON Schema. The host prompts for values, validates and stores them, then injects them into the plugin's processes. Secrets go to the OS keychain | M1, M2 (keychain), M3 (web forms) |
| "enable" | `enable` and `disable` work without uninstalling. A disabled plugin never starts and contributes nothing | M1 |
| "run plugins" | There are three paths: the agent calls plugin tools during `chat`/`run`; the user calls a tool directly with `tools call`; or the user runs a plugin command such as `run /notes:digest` | M1, M1, M2 |
| "plugin developers can add new capabilities by following a clear protocol" | A versioned manifest with a published JSON Schema, an MCP tool contract and a hook protocol, plus `validate`, `test` and `new` commands and templates | M1 draft, M2 complete |
| "CLI, desktop app, local web app, or a combination" | A CLI and a local web UI over the same core library | M1, M3 |
| "at least two plugins that are meaningfully different" | `notes` is written in Python and **adds tools**. `guard` is written in Node, adds **no tools**, and **changes host behaviour** through hooks | M1 |
| "prove that the plugin mechanism really extends the host" | Proofs include a zero-plugin baseline, an automated no-hardcoding check, and behaviour that toggles with enable/disable. Two plugins compose without knowing about each other, and a third plugin wraps an existing MCP server with no code (section 5) | M1, M2 |

The "meaningfully different" clause matters most when choosing plugins. Two tool servers in different domains would technically qualify. They would only exercise one extension point, though, so they prove much less than a tool plugin paired with a behaviour-changing plugin.

## 2. What you could build: the option space

### Product shape

A **CLI-only harness** is the fastest route and the most natural place to run a local agent. It is also the easiest to test, because every capability becomes a command you can script. The CLI is weak at the "inspect and configure" parts of the brief: long schemas, secret entry and timelines of tool and hook activity read better in a UI.

A **local web app** fixes that. It gives you auto-generated config forms, toggles and a chat view showing each tool call and hook decision inline. Serve it from the same process (`harness ui`) and it adds no install cost. Because it is a local HTTP listener, it needs care: bind to `127.0.0.1` only and require a per-launch token, since the MCP security guidance warns about DNS-rebinding attacks on localhost servers [5].

A **desktop app** (Tauri or Electron) adds packaging, signing and auto-update work. None of that serves the brief beyond what the web UI already does. If you want a desktop app later, a Tauri shell around the web UI is a cheap follow-on.

**Recommendation:** build the CLI and the local web UI as two thin clients of one `core` package. The CLI is the MVP and the web UI comes in milestone M3.

### Plugin mechanism (the most consequential decision)

There are four realistic designs. Each one is used by an existing tool.

**In-process modules** have the host import plugin code directly. Simon Willison's `llm` does this through pluggy hooks such as `register_tools` and `register_commands` [11]. OpenCode loads JavaScript and TypeScript plugins from npm, git or local folders [10]. The design is the easiest to build and gives plugins the richest API. The downsides are serious: plugins are locked to the host's language, have no isolation, can hang or crash the host, and run with full trust.

**Out-of-process MCP-only** treats every plugin as an MCP server. You get language neutrality, process isolation and instant compatibility with the large existing MCP server ecosystem. The gap is that MCP only lets a server *offer* tools, resources and prompts. A server cannot intercept the host's own loop, so a "check every tool call before it runs" plugin like `guard` is impossible. MCP now has a formal extensions mechanism [6]. Using it would mean designing a custom extension that is disabled by default and needs SDK support on both sides, which is a lot of machinery for a simple need.

**WebAssembly plugins** through Extism [17] give real sandboxing and multi-language guests. The cost is developer friction: plugins must be compiled against a plugin development kit and have restricted I/O. That is overkill for an MVP whose plugins need to read files and call local tools.

**A hybrid manifest** is the model used by Claude Code plugins [7] and Gemini CLI extensions [9]. A declarative manifest bundles several kinds of components. Code-bearing components run out of process: MCP servers provide tools, and command hooks intercept events. Declarative components, such as config schemas and prompt-template commands, need no code at all.

**Recommendation:** use the hybrid manifest. It is the only option that supports both tool plugins and behaviour plugins without language lock-in. It is also a proven pattern, so plugin authors who know Claude Code or Gemini CLI will recognise it. Concretely, take these ideas from each prior design:

- **From Claude Code:** a manifest where only `name` is required; a `userConfig`-style schema with a `sensitive` flag; root-path variables such as `${CLAUDE_PLUGIN_ROOT}`; and a `plugin validate` command that separates warnings from errors [7]. Its command-hook wire format is adopted directly as a compatible subset: event JSON on stdin, exit code 2 to block, and `allow`/`deny`/`ask` decisions with an `updatedInput` rewrite, under the same event and field names. When decisions conflict, the most restrictive wins [8].
- **From Gemini CLI:** the management command set (`install`, `uninstall`, `enable`/`disable`, `update`, `link` for development, `new` from a template, `config`), and its rule that extensions do not inherit the user's full shell environment, only safe variables plus the ones they declare [9]. Its stance that extension policies cannot grant themselves `allow` decisions is also worth copying [9].
- **From OpenCode:** installing from npm, git or local folders, and having `plugin check` and `update` commands [10].

## 3. Recommended architecture

![Architecture: thin CLI and web front-ends over a core with no plugin-specific code; plugins run as separate processes](https://private-us-east-1.manuscdn.com/sessionFile/qemJbTjVboPQa5OQCuF7I1/sandbox/VgC7ENunOLXNG8XxzhBVkh-images_1794188755218_na1fn_L2hvbWUvdWJ1bnR1L2hhcm5lc3MtcGxhbi9kaWFncmFtcy9hcmNoaXRlY3R1cmU.png?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvcWVtSmJUalZib1BRYTVPUUN1RjdJMS9zYW5kYm94L1ZnQzdFTnVuT0xYTkc4WHh6aEJWa2gtaW1hZ2VzXzE3OTQxODg3NTUyMThfbmExZm5fTDJodmJXVXZkV0oxYm5SMUwyaGhjbTVsYzNNdGNHeGhiaTlrYVdGbmNtRnRjeTloY21Ob2FYUmxZM1IxY21VLnBuZyIsIkNvbmRpdGlvbiI6eyJEYXRlTGVzc1RoYW4iOnsiQVdTOkVwb2NoVGltZSI6MTc5NjA4MzIwMH19fV19&Key-Pair-Id=K2QY5QTL8JSY6C&Signature=MEQCIHOhMI37BHImsNPbKhqfUTDu643VXuWliuYfOsOuwQOyAiAHDNxVcJJOQXH2dKLFILlBWk1uXHLkLYVdCDVh9mYyTg__)

Eight rules hold the design together.

**The core has no features.** It knows how to load manifests, store config, start processes, route tool calls, run hooks and drive the model loop, and nothing else. No tool, policy or command is built in. That makes the extensibility claim verifiable: with no plugins installed, the model sees zero tools.

**Plugins are processes.** The core spawns plugin commands as argument arrays, never through a shell. Each process gets a sanitised environment: safe variables such as `PATH`, `HOME` and `LANG`, the variables the plugin declares, and its resolved config as JSON. Its stderr goes to a per-plugin log file. One plugin crashing or hanging affects only its own tools.

**Tools are MCP.** Each `mcpServers` entry in a manifest is started with the official MCP client. Its tools are listed and namespaced as `<plugin>.<tool>`, for example `notes.search`. Tool names sent to model providers use a stricter character set, so the model sees `mcp__notes__search`, the convention Claude Code uses for MCP tools, and the mapping lives in one function. Python, Node and Go plugins, and existing third-party MCP servers, all work unchanged.

**Hooks reuse Claude Code's command-hook format.** A manifest can bind a command to a lifecycle event. The MVP needs `PreToolUse` and `PostToolUse`; `SessionStart`, `UserPromptSubmit` and `SessionEnd` follow in M2. The host writes the event as JSON to the hook's stdin and reads a decision from stdout, using Claude's field names and `hookSpecificOutput` envelope, so simple Claude guard hooks run unchanged. Exit code 2 means "block", and a hook that crashes or times out blocks by default. When several hooks fire, they run in a fixed order and each sees the previous one's rewritten input. The most restrictive decision wins: `deny` beats `ask`, which beats `allow`. The hook chain runs inside the AI SDK's `toolApproval` callback, so the user approves the input as rewritten by hooks, and that exact input is what executes.

**Config is schema-driven and injected.** A plugin declares a JSON Schema. The host generates CLI prompts (and later web forms) from it, validates values with defaults applied, and substitutes them into the plugin's command, arguments and environment through `${config.key}` variables. Fields marked as secret are masked everywhere and stored in the keychain.

**Consent comes before code runs.** Installing or enabling a plugin shows the exact commands it will run, untruncated, plus the permissions it declares. This follows MCP's security guidance for local servers [5]. Changing permissions on update requires fresh consent. OS-level enforcement of the declared permissions is an opt-in milestone (M4), covered in section 8.

**Plumbing is borrowed.** Every generic concern, from spawning processes to atomic writes, locking, schema validation, secret scanning and the model loop, goes to a maintained library behind one adapter module. Only product policy is hand-written ([LIBRARIES.md](LIBRARIES.md)).

**Front-ends are thin.** The CLI and the web server both call one `Host` facade (`open`, `start`, `tools`, `callTool`, `newSession`, `runTurn`), and the facade emits a typed event stream. The CLI renders it as text; the web UI streams it over server-sent events.

The sequence below shows the core interaction. A tool call proposed by the model passes through another plugin's hook before it reaches the plugin that owns the tool. This is how two plugins compose without either one knowing about the other.

![Sequence of a tool call: model proposes notes.write, guard's PreToolUse hook redacts a secret, the runtime calls the notes MCP server, guard's PostToolUse hook audits the result](https://private-us-east-1.manuscdn.com/sessionFile/qemJbTjVboPQa5OQCuF7I1/sandbox/VgC7ENunOLXNG8XxzhBVkh-images_1794188755218_na1fn_L2hvbWUvdWJ1bnR1L2hhcm5lc3MtcGxhbi9kaWFncmFtcy90b29sLWNhbGwtc2VxdWVuY2U.png?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvcWVtSmJUalZib1BRYTVPUUN1RjdJMS9zYW5kYm94L1ZnQzdFTnVuT0xYTkc4WHh6aEJWa2gtaW1hZ2VzXzE3OTQxODg3NTUyMThfbmExZm5fTDJodmJXVXZkV0oxYm5SMUwyaGhjbTVsYzNNdGNHeGhiaTlrYVdGbmNtRnRjeTkwYjI5c0xXTmhiR3d0YzJWeGRXVnVZMlUucG5nIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzk2MDgzMjAwfX19XX0_&Key-Pair-Id=K2QY5QTL8JSY6C&Signature=MEUCIQDr8cgL7K1TCP8XbJKkcMCxdtCrZucE-oqDnApXJLbXwgIgb7iWerZDQhDrz3NGWNZdvKZv1krZyMhZvUPAckOvm8s_)

The plugin lifecycle the CLI exposes is a small state machine. Every transition is a command or a process event.

![Plugin lifecycle from validation and consent through installed, enabled, running, crashed and uninstalled](https://private-us-east-1.manuscdn.com/sessionFile/qemJbTjVboPQa5OQCuF7I1/sandbox/VgC7ENunOLXNG8XxzhBVkh-images_1794188755218_na1fn_L2hvbWUvdWJ1bnR1L2hhcm5lc3MtcGxhbi9kaWFncmFtcy9wbHVnaW4tbGlmZWN5Y2xl.png?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvcWVtSmJUalZib1BRYTVPUUN1RjdJMS9zYW5kYm94L1ZnQzdFTnVuT0xYTkc4WHh6aEJWa2gtaW1hZ2VzXzE3OTQxODg3NTUyMThfbmExZm5fTDJodmJXVXZkV0oxYm5SMUwyaGhjbTVsYzNNdGNHeGhiaTlrYVdGbmNtRnRjeTl3YkhWbmFXNHRiR2xtWldONVkyeGwucG5nIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzk2MDgzMjAwfX19XX0_&Key-Pair-Id=K2QY5QTL8JSY6C&Signature=MEQCIBjbYK0A-LstlowpKaR8x5qY~3phDOkdPdG4oIQjp1HlAiBdd-cJmER1~uP2eiuXdrKr2kca9H4y-FhTMhvkYKMp6w__)

## 4. The plugin protocol at a glance

A plugin developer needs to learn three things: the manifest, MCP (only if they add tools), and the hook I/O format (only if they intercept events), which is Claude Code's. The full draft is in [PROTOCOL-v1-draft.md](PROTOCOL-v1-draft.md). This is what the `notes` manifest looks like:

```json
{
  "apiVersion": 1,
  "name": "notes",
  "version": "0.1.0",
  "description": "Search, read and append to a folder of Markdown notes.",
  "config": {
    "type": "object",
    "required": ["notesDir"],
    "properties": {
      "notesDir": { "type": "string", "title": "Notes folder", "format": "path" },
      "readOnly": { "type": "boolean", "default": false }
    }
  },
  "permissions": {
    "filesystem": [{ "path": "${config.notesDir}", "access": "read-write" }],
    "network": false
  },
  "mcpServers": {
    "notes": {
      "command": "uv",
      "args": ["run", "--quiet", "--script", "${plugin.root}/server.py"]
    }
  }
}
```

A hook receives one JSON document on stdin. The fields are Claude Code's; `_harness` is a namespaced extension that Claude-written hooks ignore:

```json
{
  "session_id": "s_7f3a",
  "cwd": "/Users/me/work",
  "hook_event_name": "PreToolUse",
  "tool_name": "mcp__notes__write",
  "tool_input": { "path": "todo.md", "content": "key sk-abc123456" },
  "tool_use_id": "call_01",
  "_harness": {
    "protocol": 1, "tool": "notes.write", "plugin": "notes",
    "annotations": { "readOnlyHint": false, "destructiveHint": false },
    "interactive": true
  }
}
```

It answers with one JSON document on stdout. Exiting with code 2 and writing a reason to stderr is a shortcut for `deny`.

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "permissionDecisionReason": "secret redacted",
    "updatedInput": { "path": "todo.md", "content": "key [REDACTED]" }
  }
}
```

The host passes MCP tool annotations such as `destructiveHint` and `readOnlyHint` through to hooks. A policy plugin can therefore reason about tools it has never heard of. The spike confirmed that real servers already send these annotations: the reference filesystem server marks `read_file` with `readOnlyHint: true`.

## 5. The plugins, and how they prove the point

**`notes` (Python, adds tools).** This is an MCP server written with the official Python SDK [4]. It uses PEP 723 inline dependencies, so `uv run --script` builds its environment on first use and the plugin has no install step. It exposes `search`, `read` and `write` over a configured folder of Markdown files. It rejects paths that escape that folder and honours a `readOnly` setting. In M2 it also contributes a `/notes:digest` command, a Markdown prompt template that needs no code. It exercises tools, config, permissions, commands and cross-language support.

**`guard` (Node, adds no tools).** This plugin is a single bundled script bound to `PreToolUse` and `PostToolUse`. It uses `secretlint` for secret detection and `picomatch` for patterns, bundled with esbuild so the installed plugin has no `node_modules`. Before a call, it denies tools that match configured patterns, and asks for approval on tools marked destructive or matching `ask` patterns. It also redacts secrets such as API keys from tool inputs. After a call, it redacts secrets from tool outputs and appends every decision to an audit log in JSON Lines format. A `mode: monitor` setting logs without blocking. Its one-line description is "it changes what the host does, not what the model can do." That is a different extension point, language and runtime model from `notes`, which is what makes the pair "meaningfully different".

**A third plugin with no code (M2).** This one is a ten-line manifest that wraps the official `@modelcontextprotocol/server-filesystem` package. The spike connected to both a current and an older release of that server. It shows that the protocol is not tied to plugins written for this harness.

The proof of "really extends the host" should be **automated**, not argued. Six checks do it:

1. **Zero baseline.** With a fresh harness home, the mock model's captured request contains zero tools, and `/notes:digest` is an unknown command.
2. **Install adds and uninstall removes.** After installing `notes`, exactly `mcp__notes__search`, `mcp__notes__read` and `mcp__notes__write` appear, with no rebuild. Uninstalling removes them again.
3. **No hardcoding.** An architecture test scans `packages/core` and `packages/cli` and fails on any import from `plugins/` or any mention of `notes` or `guard`.
4. **Composition through the host.** The mock model calls `notes.write` with a secret. With `guard` enabled, the file on disk contains `[REDACTED]`. With `guard` disabled, it contains the raw string. Neither plugin references the other.
5. **Cross-language.** One plugin is Python and one is Node. Neither imports a harness SDK, because the contracts are MCP and JSON over stdio.
6. **Authored from the docs alone.** In M2, `harness plugin new hello --template mcp-node` produces a plugin that passes `harness plugin test`. A live demo can then show a new capability added in minutes.

## 6. Technology choices

**Why TypeScript for the host.** Python would work too, and the plugin protocol is language-neutral either way. Four things tip the choice:

- **The MCP TypeScript SDK tracks the spec most closely.** Its v2 packages implement the 2026-07-28 spec revision and were released the day before it [2] [1].
- **One language covers the CLI, the local server and the React UI.**
- **The AI SDK provides more of the stack in one dependency.** It brings the provider abstraction, the multi-step tool loop, tool-approval hooks and mock models for tests [13].
- **Most existing MCP servers ship as npm packages run through `npx`.**

If your team is Python-first, the right-hand column of the table below is a credible alternative with no change to the protocol.

| Concern | Recommended (TypeScript, versions as of 9 Nov 2026) | Python equivalent | Note |
|---|---|---|---|
| MCP client for plugin tools | `@modelcontextprotocol/client` 2.4 | `mcp` 2.3 (`Client`) | v2 still negotiates with pre-2026 servers through the legacy `initialize` handshake [3]. The spike confirmed this |
| Agent loop, approvals, providers | `ai` 7: `ToolLoopAgent` with `toolApproval` and `toolCallConcurrency: 1`, `dynamicTool`, `jsonSchema` with an Ajv validator, `createProviderRegistry`. Providers `@ai-sdk/openai-compatible` 3, `@ai-sdk/openai` 4, `@ai-sdk/anthropic` 4 | `pydantic-ai` 2.x | One adapter file isolates the major-version churn. LIBRARIES.md lists the defaults that must be changed |
| Local models | Ollama, LM Studio, vLLM or llama.cpp through the OpenAI-compatible provider | same | Ollama supports tools on `/v1/chat/completions` but not `tool_choice` [14] |
| Test model | `MockLanguageModelV4` from `ai/test` (used in both spikes) | `TestModel` / `FunctionModel` in pydantic-ai | Makes every end-to-end test deterministic and offline |
| CLI | `commander` 15, `@inquirer/prompts` 8.7, `cli-table3`, `node:readline/promises` | `typer`, `rich`, `questionary` | Prompts are generated from each plugin's config schema by about 150 lines of mapping; no library does this well |
| Manifest and config validation | `ajv` 8.20 (`Ajv2020` with defaults and type coercion), `ajv-formats`, `dot-prop` for dotted keys, `zod` 4 for hook I/O | `pydantic` 2 + `jsonschema` | The published JSON Schema doubles as editor autocomplete for plugin authors |
| Store: paths, atomic files, locks, hashes | `env-paths` 4, `write-file-atomic` 8, `proper-lockfile` 4, `canonicalize` 5 (RFC 8785), `microdiff`, `semver` | `platformdirs`, `filelock` | Locking matters once the CLI and web UI run at the same time |
| Plugin sources (M2) | `pacote` 22 + `npm-package-arg` 14 with install scripts disabled; `simple-git` 4 pinned to a commit | `subprocess` + `git` | Requires Node 22.22.2 or later |
| Processes and logs | `execa` 10 for hooks, `p-map` 7 for parallel start, `rotating-file-stream` 3 for plugin stderr, `pino` 10 for host and audit logs | `asyncio` subprocesses | |
| Matching and secret detection | `picomatch` 4; `@secretlint/core` 13 inside `guard` | `fnmatch`; `detect-secrets` | secretlint needs hardening, covered in LIBRARIES.md |
| Secrets (M2) | `@napi-rs/keyring` 2.1 (OS keychain) | `keyring` 25 | Falls back to a `0600` file on headless Linux, never silently |
| Python plugin environments | `uv` + PEP 723 inline metadata | same | No per-plugin install step |
| Local web UI (M3) | `hono` 4.13, `@ai-sdk/react` 4 (`useChat` with approval responses), shadcn/ui components, `@rjsf/core` + `@rjsf/shadcn` 6.11, `@tanstack/react-query` 5, `vite` 8 | FastAPI + htmx or React | rjsf renders forms directly from JSON Schema [16] |
| OS sandbox (M4, opt-in) | `@anthropic-ai/sandbox-runtime` 0.0.81 (`srt`) | same CLI | Uses Seatbelt on macOS and bubblewrap on Linux; Windows is alpha; the project labels itself a beta research preview [15] |
| Plugin debugging | MCP Inspector (`mcp dev server.py`, or `@modelcontextprotocol/inspector --cli`) | same | Plugin authors get it for free [4] |
| Tests | `vitest` 5, `execa` for CLI end-to-end runs, `@inquirer/testing` | `pytest` | |

The AI SDK also ships its own lightweight MCP client, which turns a server's tools straight into model tools [12]. I would still use the official MCP client directly. The host needs control that the shortcut hides: when each process starts and stops, where its stderr goes, a way to call a tool without the model, and a place to run hooks around every call.

**What you still build yourself** is the part that makes this your product. [LIBRARIES.md](LIBRARIES.md) audits every component and lists what stays custom and why:

- the manifest and permissions schema;
- variable substitution, kept at 25 lines because the obvious library version has defects;
- the hook decision rules and the Claude wire adapter;
- the approval glue around `toolApproval`;
- staging and the registry;
- schema-to-prompt mapping;
- guard's policy rules;
- the CLI and web screens;
- the conformance kit and templates;
- the docs.

I would deliberately **not** pull in an agent framework (Mastra, LangGraph, the OpenAI or Claude agent SDKs) or a plugin-manager framework (oclif, `live-plugin-manager`); the reasons are in LIBRARIES.md. The rough size of the build is about 2,400 lines in core, 900 in the CLI, 850 in the web UI, 400 across the plugins and 3,000 in tests. That is about 4,500 lines of product code, against about 7,000 in the first draft of this plan and about 14,600 if written from scratch.

## 7. How hard is it?

**Spike evidence.** To ground the estimate I built the riskiest integration first, in [spike/](spike/). The test was a Node host using `@modelcontextprotocol/client` v2 to talk to a Python MCP plugin, with a guard hook in the middle and an AI SDK `ToolLoopAgent` driven by a scripted mock model. The model wrote a note containing `sk-abcdef123456`, then searched notes, then answered. The hook rewrote the input, the file on disk contained `rotate key [REDACTED]`, and the final answer used the search result. Everything worked on the first run.

A second spike, [spike-libs/](spike-libs/), swapped every piece of hand-rolled plumbing for the libraries above and ran the same flow with four scripted model calls. Five things held:

- a secret was redacted before the approval prompt, and the redacted text is what was written;
- schema-invalid arguments came back to the model as a tool error;
- a secret already in a note was redacted from a search result;
- a hook's exit code 2 blocked a write to a protected path;
- the hook chain ran once per call even though the approval callback ran again on resume.

It also confirmed that the official stdio transport leaves no orphan processes on shutdown. The proof section of [LIBRARIES.md](LIBRARIES.md) shows the output.

The measured startup times shape the runtime design:

- **Python plugin:** about 2.2 s on the very first start while `uv` resolves dependencies, and 0.8 to 0.9 s once warm.
- **Third-party filesystem server via `npx`:** about 4 s the first time and about 1.1 s warm.

The v2 client also connected to an older release of that server built on the v1 SDK. That confirms the backward-compatibility claim in the migration guide [3]. Since startup costs about a second per plugin, servers should start in parallel, start lazily at the first session, and have their tool lists cached.

**Effort by component.** These are focused days for one experienced TypeScript developer. A coding agent compresses the typing. It does not compress the design and debugging of process lifecycle and hook semantics much.

| Component | Complexity | Days | What makes it non-trivial (and which library carries the rest) |
|---|---|---|---|
| Manifest schema, loader, `validate` | Low | 0.5–1 | Good error messages; path containment (Ajv) |
| Plugin store: install from path, `--link`, enable/disable, uninstall, registry | Low–medium | 0.75–1 | Partial installs, name collisions (`write-file-atomic`, `proper-lockfile`, `canonicalize`) |
| Config store, substitution, schema-driven prompts | Low–medium | 0.5–1 | The schema-to-prompt mapping; secret masking (Ajv coercion and defaults, `dot-prop`, `@inquirer/prompts`) |
| MCP runtime manager | Medium | 1–1.5 | Timeouts, crash detection, state machine (MCP client, `p-map`, `rotating-file-stream`) |
| Agent loop, providers, `chat`/`run`/`tools call` | Medium (mostly library) | 1–1.5 | Approval resume, malformed tool arguments from local models (`ai` `toolApproval`, provider registry) |
| Hook engine (`PreToolUse`/`PostToolUse`) | Medium | 1 | Ordering, merge precedence, fail-closed errors, re-validating rewrites (`execa`, `picomatch`) |
| `notes` + `guard` plugins | Low | 1 | Path traversal; redaction hardening (`secretlint`, esbuild) |
| Proof tests and protocol docs v1 | Low–medium | 1 | |
| **MVP total (M0 + M1)** | | **7–10** | |
| M2: git/npm install, update, `new`, commands, session hooks, keychain, env sanitising, conformance kit, wrapped third-party server | Medium | 5–7 | Consent on update; template quality (`pacote`, `simple-git`, `microdiff`, `@napi-rs/keyring`, `yaml`) |
| M3: local web app | Medium | 4–6 | Approvals across HTTP, live timeline, auth token, file locking (`hono`, `@ai-sdk/react`, rjsf, shadcn/ui) |
| M4: hardening, opt-in sandbox via `srt`, cross-OS, packaging, docs site | Medium–high | 4–6 | Mapping declared permissions to sandbox policy; strict-env MCP transport; Windows |
| **End-to-end total** | | **~20–29** | |

**The genuinely hard parts** are few, and they are known in advance:

- **Hook semantics.** Merging decisions from several plugins, chaining rewritten inputs, and choosing between fail-open and fail-closed. These choices must be specified, not improvised. The protocol draft fixes them.
- **Process lifecycle across operating systems.** This covers orphaned processes, `PATH` differences when `uv` or `node` is missing, and Windows spawn behaviour.
- **Security.** A plugin is arbitrary code running with the user's privileges, and the MCP security guidance says so plainly [5]. Consent screens, environment sanitising, scoped secrets and approvals are cheap and fully in scope. True OS-level enforcement is the one expensive item, and it is the reason `srt` matters: it turns a multi-week build into an integration task, though a beta-quality one.

Everything else is normal application engineering.

## 8. Risks and mitigations

**Specification and SDK churn.** The 2026-07-28 MCP revision made the protocol stateless. It removed the `initialize` handshake, added `server/discover`, and deprecated sampling, roots and logging [1]. The TypeScript SDK split into new v2 packages at the same time [2]. The AI SDK ships a major version roughly every year. Mitigation: keep each library behind one adapter file (`runtime/mcp-client.ts`, `agent/model.ts`), pin major versions, and run contract tests against a fixture server on both the old and new protocol. Do not build on deprecated MCP features. Sampling and elicitation are not needed for this product.

**Local-model tool-calling quality.** Small local models sometimes produce malformed arguments or loop. Ollama's OpenAI-compatible endpoint supports `tools` but not `tool_choice` [14]. Mitigation: all automated tests use the mock model. The host validates arguments against the tool's input schema and returns validation errors to the model as tool results instead of crashing. A step limit stops loops. The docs name a short list of tested tool-capable models.

**Plugins run arbitrary code.** Mitigation, layered from cheap to expensive:

1. Show exact commands and permissions at install, and ask for consent again when permissions change.
2. Give plugin processes a sanitised environment, with each plugin's secrets passed only to that plugin.
3. Use approvals for destructive tools in interactive sessions, and treat `ask` as `deny` when no one is there to answer.
4. Offer an opt-in `sandbox: true` mode in M4 that converts the manifest's `permissions` into an `srt` policy. Its write allow-list comes from the declared filesystem paths, and its network allow-list from declared hosts [15].

The README should state the trust model honestly. Without the sandbox, permissions are declarations that drive consent, not enforcement. The OWASP MCP Top 10 [18] is a useful checklist for the M4 review.

**Dependency risk.** The design leans on roughly forty packages. Most are mature, but a few need watching. The AI SDK ships a major version roughly every year, and MCP SDK v2 is new. The sandbox runtime is beta and two optional packages are pre-1.0. Several defaults are unsafe for this product: AI SDK schemas that do not validate, tool calls that run concurrently, and Hono CSRF protection that skips JSON. Mitigation: each library sits behind one adapter module, major versions are pinned with a committed lockfile, CI runs an audit and a licence check, and each unsafe default has a regression test. The full list is in [LIBRARIES.md](LIBRARIES.md).

**Startup latency.** Measured at about a second per plugin when warm. Mitigation: parallel, lazy start; cached tool lists; and a visible "starting plugins" indicator.

**Scope creep.** A marketplace, multi-agent orchestration, plugin-contributed UI panels, model-provider plugins and a desktop shell are all tempting. None is required by the brief. They are listed as post-v1 in the spec.

## 9. The MVP

The MVP is the thinnest vertical slice that satisfies every verb in the brief through the CLI. It should end with the proof tests passing.

**In scope:**

- **Manifest v1:** `apiVersion`, metadata, `config` schema, declared `permissions`, `mcpServers`, and `hooks` for `PreToolUse` and `PostToolUse` in Claude Code's wire format.
- **Plugin commands:** install from a local path (with `--link` for development), `list`, `inspect`, `enable`, `disable`, `uninstall`, `config` and `validate`.
- **Tool commands:** `harness tools list` and `harness tools call`, which also pass through hooks.
- **Agent commands:** `harness chat` and `harness run`, using one OpenAI-compatible provider (Ollama or OpenAI) plus the mock provider.
- **Config storage:** a JSON file per plugin. Secret fields go in a separate owner-only (`0600`) file, or come from a declared environment variable. The keychain arrives in M2.
- **Plugins:** `notes` (Python) and `guard` (Node).
- **Tests:** unit tests, the six automated proofs, and a protocol draft in `docs/`.

**Out of scope for the MVP:** git and npm installs, updates, the scaffolder, commands, session hooks, keychain storage, the web UI, OS sandboxing, a registry or marketplace, provider plugins and hot reload.

The MVP demo, which is also the end-to-end test script, reads like this:

```bash
export HARNESS_HOME=$(mktemp -d)

harness tools list                    # -> No tools (0 plugins enabled)

# Shows exact command + permissions, asks consent, prompts for notesDir
harness plugin install ./plugins/notes
# Metadata, config (valid), server command, live tools, log path
harness plugin inspect notes
harness tools call notes.search --input '{"query":"offsite"}'
# Model calls mcp__notes__search and answers from the note
harness run "Where is the Q3 offsite?"

harness plugin install ./plugins/guard
# guard redacts the key before notes writes it; audit lines written
harness run "Append 'rotate key sk-abc123456789' to todo.md"

harness plugin disable guard && harness run "..."   # raw behaviour returns
harness plugin disable notes && harness tools list  # -> No tools
```

## 10. Roadmap to the end-to-end product

![Roadmap: M0 skeleton, M1 MVP CLI, M2 complete CLI product, M3 local web app, M4 hardening](https://private-us-east-1.manuscdn.com/sessionFile/qemJbTjVboPQa5OQCuF7I1/sandbox/VgC7ENunOLXNG8XxzhBVkh-images_1794188755218_na1fn_L2hvbWUvdWJ1bnR1L2hhcm5lc3MtcGxhbi9kaWFncmFtcy9yb2FkbWFw.png?Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvcWVtSmJUalZib1BRYTVPUUN1RjdJMS9zYW5kYm94L1ZnQzdFTnVuT0xYTkc4WHh6aEJWa2gtaW1hZ2VzXzE3OTQxODg3NTUyMThfbmExZm5fTDJodmJXVXZkV0oxYm5SMUwyaGhjbTVsYzNNdGNHeGhiaTlrYVdGbmNtRnRjeTl5YjJGa2JXRncucG5nIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzk2MDgzMjAwfX19XX0_&Key-Pair-Id=K2QY5QTL8JSY6C&Signature=MEUCIQDuTNkUTSodOfPpUvGLtqWZDU2jliN7gt2Pqn~6UopABgIgS~1glWOhQNaTaA8Od5WJtIvH~DYegF-OqJSHyGI786U_)

**M0, skeleton (1 day).** Set up the pnpm monorepo, strict TypeScript, vitest and CI on macOS and Linux. Turn the spike into the first integration test. *Exit:* CI is green, and a test starts a fixture MCP server and lists its tools.

**M1, MVP CLI (6 to 9 days).** Everything in section 9. *Exit:* the demo script runs end to end against a real local model, and all six proof tests pass in CI with the mock model.

**M2, complete CLI product (5 to 7 days).** This milestone adds:

- installs from git (pinned ref) and npm, plus `update` with permission-diff consent;
- `plugin new` with three templates, `plugin test` (a conformance kit that starts the plugin, checks its tools and replays hook fixtures) and `plugin logs`;
- the `commands` contribution (Markdown prompt templates, run as `/plugin:command`);
- the `SessionStart`, `UserPromptSubmit` and `SessionEnd` hooks;
- keychain secrets, a strict environment allow-list, `harness doctor`, and the third, wrapped plugin.

*Exit:* a developer who has only read `docs/PLUGIN_GUIDE.md` can build, test and install a plugin.

**M3, local web app (4 to 6 days).** `harness ui` starts a Hono server on `127.0.0.1` with a per-launch token. The React app has four areas: a plugin list with enable toggles; an inspect page (manifest, permissions, tools, hooks, health, logs); config forms generated by rjsf from each plugin's schema, with secret fields write-only; and a chat page that streams text and shows tool and hook events inline, with approve/deny buttons for `ask` decisions. *Exit:* every CLI capability except install has a web equivalent. Install works from a local path in the UI.

**M4, hardening and release (4 to 6 days).** This covers:

- an opt-in sandbox through `srt`, built from declared permissions;
- crash restarts with backoff, hook and tool timeouts, and orphan-process cleanup;
- a Windows smoke test;
- packaging as an npm package with a `harness` binary;
- a docs site, a recorded demo, and a security review against the OWASP MCP Top 10.

*Exit:* a fresh machine can go from `npm i -g` to the demo in under ten minutes.

## 11. Decisions I need from you

These are the questions that would change the plan. Each has a default I will assume if you don't say otherwise.

1. **Host language.** The default is TypeScript on Node 22.22.2 or later (22 LTS or 24), the floor set by the npm install libraries. Say so if your team would rather maintain Python. The plan carries over with the equivalents in section 6.
2. **Which models matter.** The default is local first (Ollama) with OpenAI and Anthropic also supported. If it must be fully offline, I would add a bundled model recommendation and test against it in CI nightly.
3. **What the deadline and audience are.** If this is a take-home or demo for evaluators, stop at M1 plus the M3 web UI and the M2 scaffolder (`new` and `test`), because those are what make the protocol visibly "clear". If it is a product, follow M0 to M4 in order.
4. **Security bar.** The default is consent plus approvals, with OS sandboxing opt-in in M4. If plugins will come from strangers, sandboxing moves into M2 and becomes the default.
5. **Distribution.** The default is local path, git and npm. A curated registry index (a JSON file listing plugins) is a small addition after v1 if you want discovery.
6. **Platforms.** The default is macOS and Linux first, since you're on macOS, with Windows smoke-tested in M4.
7. **Name.** "Harness" and `harness` are working names. The real name only affects the CLI binary, the home folder and the schema URL.

## References

[1]: https://modelcontextprotocol.io/specification/2026-07-28/changelog "Model Context Protocol specification 2026-07-28: Key Changes"
[2]: https://github.com/modelcontextprotocol/typescript-sdk "MCP TypeScript SDK repository - v2 implements the 2026-07-28 spec"
[3]: https://ts.sdk.modelcontextprotocol.io/v2/migration/upgrade-to-v2 "MCP TypeScript SDK v2 migration guide"
[4]: https://github.com/modelcontextprotocol/python-sdk "MCP Python SDK repository"
[5]: https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices "MCP Security Best Practices"
[6]: https://modelcontextprotocol.io/docs/extensions/overview "MCP Extensions Overview"
[7]: https://code.claude.com/docs/en/plugins/manifest-reference "Claude Code plugin manifest reference"
[8]: https://code.claude.com/docs/en/hooks "Claude Code hooks reference"
[9]: https://geminicli.com/docs/extensions/reference/ "Gemini CLI extension reference"
[10]: https://opencode.ai/docs/plugins/ "OpenCode plugins documentation"
[11]: https://llm.datasette.io/en/stable/plugins/plugin-hooks.html "LLM CLI plugin hooks - pluggy based"
[12]: https://ai-sdk.dev/cookbook/node/mcp-tools "AI SDK cookbook: MCP tools"
[13]: https://ai-sdk.dev/docs/reference/ai-sdk-core/tool-loop-agent "AI SDK ToolLoopAgent reference"
[14]: https://docs.ollama.com/api/openai-compatibility "Ollama OpenAI compatibility"
[15]: https://github.com/anthropics/sandbox-runtime "Anthropic Sandbox Runtime - srt"
[16]: https://github.com/rjsf-team/react-jsonschema-form "react-jsonschema-form"
[17]: https://github.com/extism/extism "Extism WebAssembly plugin framework"
[18]: https://owasp.org/projects/mcp-top-10 "OWASP MCP Top 10"

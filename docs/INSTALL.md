# Installation

Install a pinned GitHub Release from the private [ryamgoh/local-ai-agent-harness](https://github.com/ryamgoh/local-ai-agent-harness) repository. This project is **UNLICENSED/private source** and is **not published to the npm registry**.

## Before you start

Use macOS or Linux and Node.js **22.22.2+**; **Node 24 is recommended**. You need npm and GitHub CLI (`gh`) to follow the release commands. No pnpm, TypeScript, Git clone, or compiler is required for the packaged CLI.

The owner must invite your GitHub account as a collaborator, and you must accept the invitation. Authentication alone does not grant access to a private repository. Run `gh auth login` **on your own machine** with the invited account; do not share credentials or put them in harness configuration.

Python **3.11+** and `uv` are optional requirements for the **notes proof plugin only**. The bundled guard plugin uses Node. Ollama is needed only if you choose Ollama for local inference; hosted providers and the scripted model do not require it.

## Install v0.1.0

The initial release target is `v0.1.0`. Confirm that [the release and its asset](https://github.com/ryamgoh/local-ai-agent-harness/releases/tag/v0.1.0) have been published before downloading; the guide itself is not evidence of publication.

In a fresh download directory on your own machine:

```sh
gh auth login
gh release download v0.1.0 --repo ryamgoh/local-ai-agent-harness --pattern 'local-ai-agent-harness-0.1.0.tgz'
npm install -g ./local-ai-agent-harness-0.1.0.tgz
harness --version
harness --help
harness tools list
```

Expect version `0.1.0`, CLI help, and no tools for a fresh state directory. An existing `~/.harness` may already contain plugins; to check the empty baseline without changing it:

```sh
HARNESS_HOME="$(mktemp -d)" harness tools list
```

The tarball installs the package `local-ai-agent-harness` and exposes the `harness` command. Its internal host/CLI code is bundled, with npm runtime dependencies resolved using the included `npm-shrinkwrap.json`. npm may access its registry to download those dependencies; that does not mean the harness package is published there or that installation is fully offline. Do not replace the file path with a package-name registry install.

## Global installation without sudo

Prefer a Node version manager with a user-owned npm prefix. If your current global prefix is not writable, configure a user-owned prefix **before installing**, rather than running npm with `sudo`:

```sh
mkdir -p "$HOME/.local"
npm config set prefix "$HOME/.local"
export PATH="$HOME/.local/bin:$PATH"
npm install -g ./local-ai-agent-harness-0.1.0.tgz
harness --version
```

Add `export PATH="$HOME/.local/bin:$PATH"` to your shell startup file (`~/.zshrc` or `~/.bashrc`) for future terminals. Setting an npm prefix affects other global npm installs; if you use a Node version manager, follow its prefix guidance instead. Use the same Node environment and prefix for installation, updates, plugin asset lookup, and uninstall.

If `harness` is not found, inspect `npm config get prefix` and ensure its `bin` directory is on `PATH`. Use `command -v harness` to confirm you are running the intended installation, not a shell function or an older prefix.

## Optional proof plugins

The downloaded package contains notes and guard assets. Including them does not install, enable, or trust them. Locate the installed package, then install explicitly in an interactive terminal:

```sh
HARNESS_PACKAGE_DIR="$(npm root -g)/local-ai-agent-harness"
harness plugin validate "$HARNESS_PACKAGE_DIR/plugins/notes"
harness plugin validate "$HARNESS_PACKAGE_DIR/plugins/guard"
harness plugin install "$HARNESS_PACKAGE_DIR/plugins/notes"
harness plugin config notes set "notesDir=$HOME/.harness/data/notes" maxResults=5
harness plugin install "$HARNESS_PACKAGE_DIR/plugins/guard"
harness plugin inspect notes --live
harness tools list
```

If you set `HARNESS_HOME`, choose a notes directory under that state root instead, for example `"notesDir=$HARNESS_HOME/data/notes"`. The notes install may offer interactive configuration; the explicit command sets the chosen folder afterward.

Read each manifest, command, and declared permission before consenting. **Plugins execute arbitrary code as your user. Filesystem/network permissions are declarations for consent, not an OS sandbox.** The examples intentionally do not use `--yes`. In noninteractive use, installation without explicit consent is declined; `--yes` is only for code and actions you have already reviewed, and never overrides policy denial.

Ensure Python 3.11+ and `uv` are installed and on `PATH` before starting notes. Its PEP 723 script declares its environment; `uv` may need network access on first launch to populate its cache. The host does not run an npm/pip installer inside an installed plugin.

For the redaction/policy demo and model configuration, continue with [the README](../README.md#end-to-end-plugin-demo). Installing proof plugins is unnecessary for `harness --help` or the empty-tool baseline.

## Models and state

State defaults to `~/.harness`, including plugin registry, configuration, data, and logs. Set `HARNESS_HOME` to use another directory. The default model configuration is the OpenAI-compatible Ollama endpoint `http://localhost:11434/v1`, model `qwen3:8b`; it does not install or start Ollama for you.

Local endpoints need no credential by default. For hosted inference, store credentials in your environment or secret manager and set `model.apiKeyEnv` to the environment variable's **name**, never the key itself. Hosted inference sends prompts/tool results to the provider and can incur charges. See [Ollama](../README.md#agent-loop-with-ollama), [OpenRouter](../README.md#openrouter), or the [offline scripted model](../README.md#offline-scripted-model).

## Update or roll back

Review [the changelog](../CHANGELOG.md) and [Releases](https://github.com/ryamgoh/local-ai-agent-harness/releases) before updating. Back up your state directory, especially notes and other user content, before any update or rollback. For any **published** version, substitute its exact tag and filename:

```sh
VERSION='<published-version>'
gh release download "v$VERSION" --repo ryamgoh/local-ai-agent-harness --pattern "local-ai-agent-harness-$VERSION.tgz"
npm install -g "./local-ai-agent-harness-$VERSION.tgz"
harness --version
```

Use a fresh download directory to avoid filename collisions. The CLI has no self-update command. A CLI update does not automatically replace copied plugins already installed under your state directory. If you want a newer bundled proof plugin, recalculate `HARNESS_PACKAGE_DIR` and deliberately reinstall that plugin with `--force`, reviewing consent again; keep the existing configuration/data backed up.

To roll back, use the same commands with a known-good older **published** release asset. Check state/configuration compatibility in its release notes; do not assume an older executable can read state created by a newer version. Do not move or replace existing tags or release assets. The historical local tag `v0.1.0-mvp` is not the canonical `v0.1.0` download contract.

## Uninstall

To remove a plugin while retaining its data/logs:

```sh
harness plugin uninstall notes
harness plugin uninstall guard
```

To remove the global CLI:

```sh
npm uninstall -g local-ai-agent-harness
```

CLI uninstall does not delete `~/.harness` (or your `HARNESS_HOME`). Keep it for later reinstalls, or remove it manually only after reviewing and backing up its contents. This can include your notes and secrets; no destructive state deletion is performed by these instructions.

## Source installation

Contributors need Git, pnpm **11.25.0**, and Node **22.22.2+** (24 recommended). The full proof suite also requires Python 3.11+ and `uv`. Authenticate on your own machine as an invited collaborator:

```sh
gh auth login
gh repo clone ryamgoh/local-ai-agent-harness
cd local-ai-agent-harness
pnpm install --frozen-lockfile
pnpm build
pnpm harness --help
pnpm build:release
pnpm test:release
```

`pnpm harness ...` runs the built CLI from this checkout. `pnpm build:release` creates the installable release package, and `pnpm test:release` smoke-tests the actual tarball in an isolated npm prefix. For source proof plugins use `plugins/notes` and `plugins/guard`, not the global npm package path. See [CONTRIBUTING.md](../CONTRIBUTING.md) for all quality gates and [RELEASING.md](RELEASING.md) for versioning.

## Troubleshooting and verification limits

A private-repository 404 or failed release download can mean the invitation was not accepted, `gh` uses the wrong account, or the tag/asset has not been published. Check `gh auth status` and the authenticated release page before changing commands. A notes startup failure usually calls for checking `uv`, Python, configured `notesDir`, and the plugin log reported by the CLI. An Ollama connection error calls for starting the local service and pulling a tool-capable model.

[VERIFICATION.md](../VERIFICATION.md) records prior Linux and live OpenRouter evidence, not new remote release results. Check [Actions](https://github.com/ryamgoh/local-ai-agent-harness/actions) for current CI. The clean macOS/Ollama manual demo is still pending; passing automated macOS runner tests does not establish that Ollama demo. Windows is not claimed as verified.

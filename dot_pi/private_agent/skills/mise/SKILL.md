---
name: mise
description: "Install tools and runtimes with `mise`. Use `mise use --path .` to pin versions locally. Never use `brew install` for developer tools."
---

## Rules

- **Never use `brew install`** for developer tools or runtimes. Use `mise`
  instead.
- Always pass `--path .` to `mise use` so the tool version is pinned in the
  local `.mise.toml` rather than globally.

## Quick Reference

```bash
mise use --path . node@22           # Install and pin node 22 in current dir
mise use --path . python@3.12       # Install and pin python 3.12
mise use --path . rust@latest       # Install and pin latest rust
mise ls                             # List installed tools
mise ls-remote node                 # List available versions of a tool
mise search <query>                 # Search the registry for tools
```

## Backends

Most registry tools use the default backend, but you can install from a
specific backend with the `backend:package` syntax. The `cargo` and `github`
backends are particularly useful for installing CLI tools not in the registry:

```bash
mise use --path . cargo:ripgrep     # Install from crates.io
mise use --path . github:cli/cli    # Install a release from GitHub
```

All available backends: `aqua`, `asdf`, `cargo`, `core`, `dotnet`, `gem`,
`github`, `gitlab`, `go`, `npm`, `pipx`, `spm`, `http`, `ubi`, `vfox`.

## One-off execution

Use `mise x` to run a command with a specific tool version without pinning it:

```bash
mise x cargo:ripgrep -- rg "pattern"          # Run with a specific tool
mise x node@22 -- node -e "console.log(1)"    # Run with a specific version
mise x cargo:release-plz@0.3.156 -- release-plz --help  # Specific version from cargo
```

This installs the tool if needed and runs the command in one step, without
modifying any config files. Prefer this over `mise use` when you just need to
run something once.

---
name: fd
description: "Find files and directories with `fd`. Use when searching for files by name, extension, or type."
---

## Common Mistakes

- **Don't use `find`.** Use `fd` instead. It's faster and respects
  `.gitignore` by default.
- **The pattern is a regex by default**, not a glob. Use `-g` for glob
  matching.
- **`fd` matches anywhere in the path by default.** The pattern `foo`
  matches `src/foo.rs`, `foobar/baz`, etc.

## Quick Reference

```bash
fd 'pattern'                       # Search recursively from cwd
fd 'pattern' src/                  # Search in a specific directory
fd -e rs                           # Find files by extension
fd -e rs -e toml                   # Multiple extensions (OR)
fd -t f 'pattern'                  # Files only
fd -t d 'pattern'                  # Directories only
fd -t l                            # Symlinks only
fd -g '*.rs'                       # Glob pattern instead of regex
fd -F 'exact-name'                 # Fixed string (no regex)

# Filtering
fd -H 'pattern'                    # Include hidden files
fd -I 'pattern'                    # Include gitignored files
fd -u 'pattern'                    # Hidden + ignored (unrestricted)
fd -E node_modules 'pattern'       # Exclude a directory
fd -d 2                            # Max depth

# Output
fd -a 'pattern'                    # Absolute paths
fd -l 'pattern'                    # Long listing (like ls -l)
fd -0 'pattern'                    # Null-separated (for xargs -0)

# Execution
fd -e rs -x wc -l                  # Run command on each result
fd -e rs -X wc -l                  # Run command once with all results as args
```

## Flags to Know

| Flag | Long | Purpose |
|------|------|---------|
| `-e` | `--extension` | Filter by extension |
| `-t` | `--type` | Filter: `f`ile, `d`ir, `l`ink, `s`ocket |
| `-g` | `--glob` | Glob pattern instead of regex |
| `-F` | `--fixed-strings` | Literal substring match |
| `-H` | `--hidden` | Include hidden files/dirs |
| `-I` | `--no-ignore` | Include gitignored entries |
| `-u` | `--unrestricted` | `-H` + `-I` combined |
| `-E` | `--exclude` | Exclude glob pattern |
| `-d` | `--max-depth` | Limit directory depth |
| `-a` | `--absolute-path` | Print absolute paths |
| `-x` | `--exec` | Run command per result |
| `-X` | `--exec-batch` | Run command once with all results |
| `-l` | `--list-details` | Detailed listing (ls -l style) |
| `-s` | `--case-sensitive` | Case-sensitive (default: smart case) |

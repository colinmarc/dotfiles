---
name: ripgrep
description: "Search file contents with `rg`. Use when grepping for patterns in code, logs, or text files."
---

## Common Mistakes

- **`-r` is `--replace`, not recursive.** `rg` is recursive by default.
  Never use `-r` unless you actually want to transform output (rare).
- **Don't use `grep`.** Use `rg` instead. It's faster and respects
  `.gitignore` by default.

## Quick Reference

```bash
rg 'pattern'                       # Search recursively from cwd
rg 'pattern' src/                  # Search in a specific directory
rg -i 'pattern'                    # Case-insensitive
rg -F 'literal.string'            # Fixed string (no regex)
rg -w 'word'                       # Match whole words only
rg -l 'pattern'                    # List matching filenames only
rg -c 'pattern'                    # Count matches per file
rg -n 'pattern'                    # Show line numbers (default)

# File type filtering
rg -t rust 'pattern'              # Search only Rust files
rg -T json 'pattern'              # Exclude JSON files
rg --type-list                     # List known file types
rg -g '*.toml' 'pattern'          # Glob filter

# Context
rg -C 3 'pattern'                 # 3 lines of context around match
rg -B 2 -A 5 'pattern'            # 2 before, 5 after

# Advanced
rg -U 'multi\nline'               # Multiline matching
rg --no-ignore 'pattern'          # Don't respect .gitignore
rg -. 'pattern'                   # Search hidden files too (short for --hidden)
rg -o 'capture(group)'            # Print only the matching part
rg -e 'pat1' -e 'pat2'            # Multiple patterns (OR)
```

## Flags to Know

| Flag | Long | Purpose |
|------|------|---------|
| `-i` | `--ignore-case` | Case-insensitive |
| `-S` | `--smart-case` | Case-insensitive unless uppercase in pattern (default) |
| `-F` | `--fixed-strings` | Literal match, no regex |
| `-w` | `--word-regexp` | Whole word match |
| `-l` | `--files-with-matches` | Filenames only |
| `-c` | `--count` | Count matching lines per file |
| `-o` | `--only-matching` | Print only the matched text |
| `-n` | `--line-number` | Show line numbers (on by default for tty) |
| `-U` | `--multiline` | Allow `\n` in patterns |
| `-g` | `--glob` | Include/exclude by glob (`-g '!*.min.js'` to exclude) |
| `-t` | `--type` | Filter by file type |
| `-T` | `--type-not` | Exclude file type |
| `-C` | `--context` | Lines of context around match |
| `.`  | `--hidden` | Include hidden files |

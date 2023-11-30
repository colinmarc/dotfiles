alias jf="jq '.'"
alias ag="ag --noheading"
alias ls="ls -G"
alias http=xh

function line {
  cat $2 | head -n $1 | tail -1
}

function kills {
  kill "$(ps -ef | selecta | awk '{print $2}')"
}

export LC_ALL=en_US.UTF-8
export LANG=en_US.UTF-8
export EDITOR='vim'
export HISTSIZE=1000
export HISTFILESIZE=10000

export PROMPT='%F{cyan}%2~ %#%f '
export CLICOLOR=1
export LSCOLORS=gxBxhxDxfxhxhxhxhxcxcx

export GPG_TTY=$(tty)
export SSH_AUTH_SOCK=/Users/colinmarc/Library/Containers/com.maxgoedjen.Secretive.SecretAgent/Data/socket.ssh

# Tailscale
alias tailscale=/Applications/Tailscale.app/Contents/MacOS/Tailscale

# Homebrew
eval "$(/opt/homebrew/bin/brew shellenv)"

# Sublime Text
export PATH="/Applications/Sublime Text.app/Contents/SharedSupport/bin:$PATH"

# Go
export GOPATH="$HOME/.go"
export PATH="$GOPATH/bin:$PATH"

# Rust
export PATH="$HOME/.cargo/bin:$PATH"

# VS Code
export PATH="$PATH:/Applications/Visual Studio Code.app/Contents/Resources/app/bin"

# Gcloud
. /opt/google-cloud-sdk/completion.zsh.inc
. /opt/google-cloud-sdk/path.zsh.inc

# Vulkan
export VULKAN_SDK="/opt/vulkan/1.3.261.1/macOS"
export PATH="$VULKAN_SDK/bin:$PATH"
export DYLD_LIBRARY_PATH="$VULKAN_SDK/lib:$DYLD_LIBRARY_PATH"
export VK_ICD_FILENAMES="$VULKAN_SDK/share/vulkan/icd.d/MoltenVK_icd.json"
export VK_ADD_LAYER_PATH="$VULKAN_SDK/share/vulkan/explicit_layer.d"
export VK_DRIVER_FILES="$VULKAN_SDK/share/vulkan/icd.d/MoltenVK_icd.json"

_has() {
  whence -p "$1" > /dev/null
}

function _prompt_git {
  [ "$(git rev-parse --is-inside-work-tree 2>/dev/null)" = 'true' ] || return

  local branch modified
  branch=$(git symbolic-ref --quiet --short HEAD)
  if [ "$?" != 0 ]; then
    branch="HEAD"
  fi

  if ! git diff-index --quiet --cached HEAD 2>/dev/null || ! git diff-files --quiet; then
    modified=" %F{red}*%F{cyan}"
  fi
  echo "%F{cyan}[$branch$modified] "
}

function _set_prompt {
  # Report exit status of last process if it was unsuccessful
  PROMPT=$'%(?..%F{red}%?%f\n)'

  # Git branch and modification status, if applicable
  if _has git; then
    PROMPT+=$(_prompt_git)
  fi
  # Path to file
  PROMPT+='%F{cyan}%2~ %#%f '
}

precmd_functions+=( _set_prompt )


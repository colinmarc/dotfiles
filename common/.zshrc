alias ag="rg --no-heading"
alias rg="rg --no-heading"
alias ls="eza"
alias http=xh

function line {
  cat $2 | head -n $1 | tail -1
}

export LC_ALL=en_US.UTF-8
export LANG=en_US.UTF-8
export EDITOR='nvim'
export HISTFILE=~/.zsh/history
export HISTSIZE=1000
export HISTFILESIZE=10000
export SAVEHIST=10000
setopt SHARE_HISTORY

export CLICOLOR=1
export LSCOLORS=gxBxhxDxfxhxhxhxhxcxcx

#bindkey -v
bindkey '^R' history-incremental-search-backward
bindkey '^[f' forward-word
bindkey '^[b' backward-word

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

  # User and host, if applicable
  if [ -n "$SSH_CLIENT" ] || [ -n "$SSH_TTY" ]; then
    PROMPT+='%F{blue}(%m)%f '
  fi

  # Git branch and modification status, if applicable
  if _has git; then
    PROMPT+=$(_prompt_git)
  fi

  # Path to file
  PROMPT+='%F{cyan}%2~ %#%f '
}

precmd_functions+=( _set_prompt )

# znap
if [[ ! -r ~/.zsh/plugins/znap/znap.zsh ]]; then
    mkdir -p ~/.zsh/plugins
    git clone --depth 1 -- https://github.com/marlonrichert/zsh-snap.git ~/.zsh/plugins/znap
fi

source ~/.zsh/plugins/znap/znap.zsh
znap source zsh-users/zsh-autosuggestions

for file in ~/.zsh/.zshrc.d/*; do
  source $file
done

. "$HOME/.local/share/../bin/env"

# Added by LM Studio CLI (lms)
export PATH="$PATH:/home/colinmarc/.lmstudio/bin"

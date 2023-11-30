alias ag="ag --noheading"
alias ls="ls -G"
alias http=xh

function line {
  cat $2 | head -n $1 | tail -1
}

export LC_ALL=en_US.UTF-8
export LANG=en_US.UTF-8
export EDITOR='vim'
export HISTSIZE=1000
export HISTFILESIZE=10000

export CLICOLOR=1
export LSCOLORS=gxBxhxDxfxhxhxhxhxcxcx

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


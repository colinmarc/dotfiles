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
export SSH_AUTH_SOCK=$(gpgconf --list-dirs agent-ssh-socket)
gpgconf --launch gpg-agent


# Sublime Text
export PATH="/Applications/Sublime Text.app/Contents/SharedSupport/bin:$PATH"

# Go
export GOPATH=/usr/local/golang
export PATH="$GOPATH/bin:$PATH"

# Rust
export PATH="$HOME/.cargo/bin:$PATH"

# VS Code
export PATH="$PATH:/Applications/Visual Studio Code.app/Contents/Resources/app/bin"
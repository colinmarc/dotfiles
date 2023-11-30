#!/bin/sh -eux

sudo scutil --set HostName severian.home

cd $(dirname $0)/..
DOTFILES=$(pwd)

brew -h > /dev/null || /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)"
cat $DOTFILES/macos/brew.txt | xargs brew install

for NAME in .zshrc .gitconfig .zshenv .iterm2 .vimrc; do
	echo "Installing $NAME"
	rm -rf ~/$NAME > /dev/null 2>&1 || true
	ln -s $DOTFILES/macos/$NAME ~/$NAME
done

for NAME in settings.json keybindings.json; do
	rm -f "$HOME/Library/Application Support/Code/User/$NAME"
	ln -s "$DOTFILES/common/vscode/$NAME" "$HOME/Library/Application Support/Code/User/$NAME"
done

defaults write com.googlecode.iterm2.plist PrefsCustomFolder -string "~/.iterm2"
defaults write com.googlecode.iterm2.plist LoadPrefsFromCustomFolder -bool true

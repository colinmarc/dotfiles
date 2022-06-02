#!/bin/sh

sudo scutil --set HostName severian.home

cd $(dirname $0)
DOTFILES=$(pwd)

brew -h > /dev/null || /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)"
cat brew.txt | xargs brew install

for NAME in .zshrc .gitconfig .zshenv .iterm2 .vimrc .gnupg/gpg-agent.conf; do
	echo "Installing $NAME"
	rm -rf ~/$NAME > /dev/null 2>&1 || true
	ln -s $DOTFILES/$NAME ~/$NAME
done

echo "Installing sublime settings"
SUBLIME_USER_PACKAGE="$HOME/Library/Application Support/Sublime Text 3/Packages/User"
rm -rf "$SUBLIME_USER_PACKAGE"
ln -s $DOTFILES/sublime "$SUBLIME_USER_PACKAGE"

for NAME in setting.json keybindings.json; do
	rm -f "$HOME/Library/Application\ Support/Code/User/$NAME"
	ln -s "$DOTFILES/vscode/$NAME $HOME/Library/Application\ Support/Code/User/$NAME"
done

defaults write com.googlecode.iterm2.plist PrefsCustomFolder -string "~/.iterm2"
defaults write com.googlecode.iterm2.plist LoadPrefsFromCustomFolder -bool true

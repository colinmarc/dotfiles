#!/bin/sh -eux

cd $(dirname $0)/..
DOTFILES=$(pwd)

rm -rf ~/.config/sway/config > /dev/null 2>&1 || true
mkdir -p ~/.config/sway
ln -s "$DOTFILES/baldanders/sway/config" ~/.config/sway/config

for NAME in .zshenv .zshrc .vimrc .gitconfig.aliases; do
	echo "Installing $NAME"
	rm -rf ~/$NAME > /dev/null 2>&1 || true
	ln -s $DOTFILES/common/$NAME ~/$NAME
done

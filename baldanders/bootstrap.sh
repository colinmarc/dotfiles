#!/bin/sh -eux

cd $(dirname $0)/..
DOTFILES=$(pwd)

pamac install --no-confirm \
	gtk-engine-murrine \
	gtk-engines \
	matcha-gtk-theme \
	ttf-inconsolata \
	alacritty \
	the_silver_searcher \
	code \
	neofetch \
	bash-completion \
	spotifyd

pamac build --no-confirm -k code-marketplace
cargo install kickoff

IFS=$'\n'
for NAME in $(find "$DOTFILES/baldanders" -type f,l -printf '%P\n'); do
	rm -f "$HOME/$NAME"
	mkdir -p $(dirname "$HOME/$NAME")
	ln -s "$DOTFILES/baldanders/$NAME" "$HOME/$NAME"
done

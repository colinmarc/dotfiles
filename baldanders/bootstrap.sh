#!/bin/sh -eux

cd $(dirname $0)/..
DOTFILES=$(pwd)

IFS=$'\n'
for NAME in $(find "$DOTFILES/baldanders" -type f,l -printf '%P\n'); do
	rm -f "$HOME/$NAME"
	mkdir -p $(dirname "$HOME/$NAME")
	ln -s "$DOTFILES/baldanders/$NAME" "$HOME/$NAME"
done
#!/bin/sh -eux

cd $(dirname $0)/..
DOTFILES=$(pwd)

pamac install --no-confirm \
	gtk-engine-murrine \
	gtk-engines        \
	matcha-gtk-theme   \
	ttf-inconsolata-nerd \
	alacritty          \
	code               \
	neofetch           \
	bash-completion    \
	spotifyd           \
	                   \
	neovim             \
	ripgrep            \
	glow               \
	fzf                \

pamac build --no-confirm -k git-fixup protobuf-language-server-git
cargo install kickoff eza tealdeer procs dim-screen

IFS=$'\n'
for NAME in $(find "$DOTFILES/baldanders" -type f,l -printf '%P\n'); do
	rm -f "$HOME/$NAME"
	mkdir -p $(dirname "$HOME/$NAME")
	ln -s "$DOTFILES/baldanders/$NAME" "$HOME/$NAME"
done

# wluma
cd /tmp
ls wluma || git clone git@github.com:maximbaz/wluma
cd wluma
cargo build --release
sudo cp target/release/wluma /usr/bin/wluma
cp wluma.service "$HOME/.config/systemd/user/"
systemctl --user daemon-reload
systemctl --user enable wluma.service
systemctl --user start wluma.service

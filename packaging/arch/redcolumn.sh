#!/bin/sh
# Launcher for the leojru/redcolumn fork. Added in the fork.
# Extra Electron flags can go in ~/.config/redcolumn-flags.conf, one per line (lines starting with #
# are ignored), the way Arch's own Electron apps read theirs. For example:
#   --ozone-platform=wayland
#   --enable-wayland-ime
flags_file="${XDG_CONFIG_HOME:-$HOME/.config}/redcolumn-flags.conf"
flags=""
if [ -r "$flags_file" ]; then
  flags="$(grep -v '^[[:space:]]*#' "$flags_file" | tr '\n' ' ')"
fi
# shellcheck disable=SC2086 # the flags are meant to split into words
exec /opt/redcolumn/redcolumn $flags "$@"

#!/bin/sh
set -eu

REPO="helius-labs/zolana"
BIN="zolana-ring"
API="https://api.github.com/repos/$REPO/releases?per_page=100"
# The API allows 60 calls an hour per address, so a shared network falls back to this.
DEFAULT_VERSION="v0.1.0-alpha.2"
BIN_DIR="${ZOLANA_RING_BIN_DIR:-$HOME/.local/bin}"

die() {
	printf '%s\n' "$*" >&2
	exit 1
}

if command -v curl >/dev/null 2>&1; then
	DOWNLOADER="curl"
elif command -v wget >/dev/null 2>&1; then
	DOWNLOADER="wget"
else
	die "install.sh needs curl or wget. Install one of them and run this again."
fi

fetch() {
	if [ "$DOWNLOADER" = "curl" ]; then
		curl -fsSL "$1" -o "$2"
	else
		wget -q -O "$2" "$1"
	fi
}

# A token raises the API allowance, the call works without one.
fetch_api() {
	token="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
	if [ "$DOWNLOADER" = "curl" ]; then
		if [ -n "$token" ]; then
			curl -fsSL -H "Authorization: Bearer $token" "$1" -o "$2" 2>/dev/null
		else
			curl -fsSL "$1" -o "$2" 2>/dev/null
		fi
	elif [ -n "$token" ]; then
		wget -q --header="Authorization: Bearer $token" -O "$2" "$1" 2>/dev/null
	else
		wget -q -O "$2" "$1" 2>/dev/null
	fi
}

os="$(uname -s)"
arch="$(uname -m)"
case "$os $arch" in
Darwin\ arm64) platform="darwin-arm64" ;;
Linux\ x86_64) platform="linux-x64" ;;
*)
	die "$(
		cat <<EOF
No prebuilt $BIN for $os $arch.
The releases give darwin-arm64 (Apple silicon) and linux-x64 (Intel or AMD 64-bit) only.
Build it from source instead:
  cargo install --git https://github.com/$REPO custom-ring-cli
The crate is custom-ring-cli and the binary it makes is $BIN.
EOF
	)"
	;;
esac
printf 'Platform %s\n' "$platform"

tmp_dir="$(mktemp -d 2>/dev/null || mktemp -d -t zolana-ring)"
mkdir -p "$BIN_DIR" || die "Cannot make the install directory $BIN_DIR."
# The staged file shares a filesystem with the target, so the mv is a rename.
tmp_bin="$BIN_DIR/.$BIN.$$"
trap 'rm -rf "$tmp_dir" "$tmp_bin"' EXIT INT TERM

version="${ZOLANA_RING_VERSION:-}"
if [ -n "$version" ]; then
	printf 'Version %s (from ZOLANA_RING_VERSION)\n' "$version"
else
	if fetch_api "$API" "$tmp_dir/releases.json"; then
		# One JSON field per line, so a tag_name always comes before the assets of its own release.
		tr -d ' \t' <"$tmp_dir/releases.json" | tr ',{}[]' '\n\n\n\n\n' >"$tmp_dir/fields"
		tag=""
		while IFS= read -r line; do
			case "$line" in
			'"tag_name":"'*)
				tag="${line#\"tag_name\":\"}"
				tag="${tag%\"}"
				;;
			'"name":"'"$BIN-$platform"-*)
				version="$tag"
				break
				;;
			esac
		done <"$tmp_dir/fields"
	fi
	if [ -z "$version" ]; then
		version="$DEFAULT_VERSION"
		printf 'The release list is unavailable, falling back.\n' >&2
	fi
	printf 'Version %s\n' "$version"
fi

asset="$BIN-$platform-$version"
url="https://github.com/$REPO/releases/download/$version/$asset"
printf 'Download %s\n' "$url"
fetch "$url" "$tmp_bin" || die "Cannot download $asset. Check that the release $version has this asset."
chmod +x "$tmp_bin"
"$tmp_bin" --version >/dev/null 2>&1 || "$tmp_bin" --help >/dev/null 2>&1 ||
	die "The downloaded $asset does not run on this machine. Nothing was installed."
mv -f "$tmp_bin" "$BIN_DIR/$BIN"
printf 'Installed %s\n' "$BIN_DIR/$BIN"

case ":$PATH:" in
*":$BIN_DIR:"*)
	printf '%s is on your PATH. Run %s --help to start.\n' "$BIN_DIR" "$BIN"
	exit 0
	;;
esac

# Keep $HOME and ~ unexpanded in the printed commands so they stay copy-paste safe.
dir_text="$BIN_DIR"
case "$BIN_DIR" in "$HOME"/*) dir_text="\$HOME/${BIN_DIR#"$HOME"/}" ;; esac
shell_name="${SHELL##*/}"
case "$shell_name" in
zsh)
	rc="~/.zshrc"
	add="export PATH=\"$dir_text:\$PATH\""
	;;
bash)
	if [ "$os" = "Darwin" ]; then rc="~/.bash_profile"; else rc="~/.bashrc"; fi
	add="export PATH=\"$dir_text:\$PATH\""
	;;
fish)
	rc="~/.config/fish/config.fish"
	add="fish_add_path $dir_text"
	;;
*)
	rc=""
	add="export PATH=\"$dir_text:\$PATH\""
	;;
esac

printf '%s is not on your PATH.\n' "$BIN_DIR"
if [ -n "$rc" ]; then
	printf 'Add it with:\n'
	printf "  echo '%s' >> %s\n" "$add" "$rc"
	printf '  source %s\n' "$rc"
else
	printf 'Shell %s is not one this script knows. Put this line in its startup file:\n' "${shell_name:-unknown}"
	printf '  %s\n' "$add"
fi

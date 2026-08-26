#!/bin/sh
set -eu

REPO="helius-labs/zolana"
BINS="zolana-ring zolana"
API="https://api.github.com/repos/$REPO/releases?per_page=100"
BIN_DIR="${ZOLANA_RING_BIN_DIR:-$HOME/.local/bin}"

die() {
	printf '%s\n' "$*" >&2
	exit 1
}

# The two CLIs ship under separate tags, so each one resolves and pins on its own.
pinned_version() {
	case "$1" in
	zolana-ring) printf 'v0.1.0-alpha.2\n' ;;
	zolana) printf 'v0.1.0-alpha\n' ;;
	esac
}

wanted_version() {
	case "$1" in
	zolana-ring) printf '%s\n' "${ZOLANA_RING_VERSION:-}" ;;
	zolana) printf '%s\n' "${ZOLANA_VERSION:-}" ;;
	esac
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
No prebuilt zolana-ring or zolana for $os $arch.
The releases give darwin-arm64 (Apple silicon) and linux-x64 (Intel or AMD 64-bit) only.
Build them from source instead:
  cargo install --git https://github.com/$REPO custom-ring-cli
  cargo install --git https://github.com/$REPO zolana-cli
The crate custom-ring-cli makes zolana-ring, the crate zolana-cli makes zolana.
EOF
	)"
	;;
esac
printf 'Platform %s\n' "$platform"

tmp_dir="$(mktemp -d 2>/dev/null || mktemp -d -t zolana-ring)"
mkdir -p "$BIN_DIR" || die "Cannot make the install directory $BIN_DIR."
tmp_bin=""
trap 'rm -rf "$tmp_dir"; [ -z "$tmp_bin" ] || rm -f "$tmp_bin"' EXIT INT TERM

need_list=""
for b in $BINS; do
	[ -n "$(wanted_version "$b")" ] || need_list="1"
done
if [ -n "$need_list" ]; then
	# One JSON field per line, so a tag_name always comes before the assets of its own release.
	if fetch_api "$API" "$tmp_dir/releases.json"; then
		tr -d ' \t' <"$tmp_dir/releases.json" | tr ',{}[]' '\n\n\n\n\n' >"$tmp_dir/fields"
	else
		printf '%s\n' "The release list is unreachable, often the GitHub API allowance of 60 an hour per address." >&2
		printf '%s\n' "Set ZOLANA_RING_VERSION or ZOLANA_VERSION to a tag, or GITHUB_TOKEN to raise the allowance." >&2
	fi
fi

# The newest release that carries an asset for this binary and platform wins.
resolve_version() {
	[ -s "$tmp_dir/fields" ] || return 0
	tag=""
	while IFS= read -r line; do
		case "$line" in
		'"tag_name":"'*)
			tag="${line#\"tag_name\":\"}"
			tag="${tag%\"}"
			;;
		'"name":"'"$1-$platform"-*)
			printf '%s\n' "$tag"
			return 0
			;;
		esac
	done <"$tmp_dir/fields"
}

install_binary() {
	bin="$1"
	version="$(wanted_version "$bin")"
	if [ -n "$version" ]; then
		printf '%s %s (from the environment)\n' "$bin" "$version"
	else
		version="$(resolve_version "$bin")"
		if [ -z "$version" ]; then
			version="$(pinned_version "$bin")"
			printf '%s\n' "Using the pinned $version for $bin, which can be older than the newest release." >&2
		fi
		printf '%s %s\n' "$bin" "$version"
	fi

	asset="$bin-$platform-$version"
	printf '  https://github.com/%s/releases/download/%s/%s\n' "$REPO" "$version" "$asset"
	tmp_bin="$BIN_DIR/.$bin.$$"
	fetch "https://github.com/$REPO/releases/download/$version/$asset" "$tmp_bin" ||
		die "Cannot download $asset. Check that the release $version has this asset."
	chmod +x "$tmp_bin"
	"$tmp_bin" --version >/dev/null 2>&1 || "$tmp_bin" --help >/dev/null 2>&1 ||
		die "The downloaded $asset does not run on this machine. $bin was not installed."
	mv -f "$tmp_bin" "$BIN_DIR/$bin"
	tmp_bin=""
	printf '  installed %s\n' "$BIN_DIR/$bin"
}

for b in $BINS; do
	install_binary "$b"
done

case ":$PATH:" in
*":$BIN_DIR:"*)
	printf '%s is on your PATH. Run zolana-ring --help to start.\n' "$BIN_DIR"
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

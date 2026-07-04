#!/usr/bin/env bash
set -euo pipefail

version="${GIT_CLIFF_VERSION:-2.8.0}"
archive="git-cliff-${version}-x86_64-unknown-linux-gnu.tar.gz"
url="https://github.com/orhun/git-cliff/releases/download/v${version}/${archive}"
workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

curl -LsSf "$url" -o "$workdir/$archive"
tar -xzf "$workdir/$archive" -C "$workdir"
sudo install -m 0755 "$workdir/git-cliff-${version}/git-cliff" /usr/local/bin/git-cliff
git-cliff --version

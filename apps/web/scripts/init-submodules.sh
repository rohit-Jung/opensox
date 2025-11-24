#!/bin/bash
# initialize git submodules during vercel build

set -e  # Exit immediately on any error

# setup ssh for private submodule
if [ -n "$GIT_SSH_KEY" ]; then
  mkdir -p ~/.ssh || { echo "Failed to create ~/.ssh directory" >&2; exit 1; }
  printf '%s' "$GIT_SSH_KEY" > ~/.ssh/id_ed25519 || { echo "Failed to write SSH key" >&2; exit 1; }
  chmod 600 ~/.ssh/id_ed25519 || { echo "Failed to set SSH key permissions" >&2; exit 1; }
  ssh-keyscan -t ed25519 github.com >> ~/.ssh/known_hosts 2>/dev/null || true
fi

# initialize and update submodules
git submodule update --init --recursive --remote

echo "submodules initialized successfully"


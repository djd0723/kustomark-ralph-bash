#!/bin/bash
# Fix React symlinks for testing
# This ensures there's only one React instance across the project
# Run this after installing dependencies in src/web/client

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB_CLIENT="$PROJECT_ROOT/src/web/client/node_modules"
ROOT_MODULES="$PROJECT_ROOT/node_modules"

echo "Fixing React symlinks for testing..."

# Remove any existing React installations from web client
for module in react react-dom @types/react @types/react-dom; do
  target="$WEB_CLIENT/$module"
  if [ -e "$target" ] && [ ! -L "$target" ]; then
    echo "Removing duplicate: $target"
    rm -rf "$target"
  fi
done

# Create symlinks to root React modules
for module in react react-dom @types/react @types/react-dom; do
  source="$ROOT_MODULES/$module"
  target="$WEB_CLIENT/$module"

  if [ -e "$source" ]; then
    if [ ! -e "$target" ]; then
      echo "Creating symlink: $module"
      ln -s "$source" "$target"
    elif [ -L "$target" ]; then
      echo "Symlink already exists: $module"
    else
      echo "Warning: $target exists but is not a symlink"
    fi
  else
    echo "Warning: Source not found: $source"
  fi
done

echo ""
echo "Verifying symlinks..."
ls -la "$WEB_CLIENT" | grep -E "react|react-dom" | grep -v "react-"

echo ""
echo "Done! React is now using a single shared instance."
echo "You can now run: bun test tests/web/"

#!/usr/bin/env bash
# setup-skills.sh — Create .mintlify/skills/ symlinks from the salesforce-skills submodule.
# Run after: git submodule update --init

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SUBMODULE="$REPO_ROOT/.salesforce-skills/skills"
SKILLS_DIR="$REPO_ROOT/.mintlify/skills"

if [ ! -d "$SUBMODULE" ]; then
  echo "Error: submodule not found at $SUBMODULE"
  echo "Run: git submodule update --init"
  exit 1
fi

mkdir -p "$SKILLS_DIR"

SKILLS=(
  # Data Cloud pipeline
  sf-datacloud
  sf-datacloud-connect
  sf-datacloud-prepare
  sf-datacloud-harmonize
  sf-datacloud-segment
  sf-datacloud-act
  sf-datacloud-retrieve
  sf-datacloud-unify
  sf-datacloud-mce-unify
  sf-datacloud-snowflake-salesforce-segment
  # Cross-cutting
  sf-soql
  sf-metadata
  sf-deploy
)

for skill in "${SKILLS[@]}"; do
  target="../../.salesforce-skills/skills/$skill"
  link="$SKILLS_DIR/$skill"

  if [ -L "$link" ]; then
    echo "exists: $skill"
  elif [ -e "$link" ]; then
    echo "skip:   $skill (non-symlink file exists)"
  else
    ln -s "$target" "$link"
    echo "linked: $skill"
  fi
done

echo ""
echo "Done. $(ls -1 "$SKILLS_DIR" | wc -l | tr -d ' ') skills linked in .mintlify/skills/"

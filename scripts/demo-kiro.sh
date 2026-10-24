#!/bin/zsh
# On-camera Kiro evidence for the demo video (clip S10): the spec rule, the bug the property
# tests found and its fix, the property tests passing, and the hook blocking a clinical-data edit.
# Each step prints the command it runs, then pauses so the viewer can read it.
cd "${0:A:h}/.." || exit 1
step() { print -P "\n%F{cyan}\$ $1%f"; eval "$1"; sleep "${2:-4}"; }
clear
step 'grep "^\*\*R21" .kiro/specs/rxgene-engine/requirements.md | cut -c1-170'
step 'grep "Shrunk counterexample" .kiro/specs/rxgene-engine/analysis.md | cut -c1-130'
step 'git log --oneline -1 1c9b81b' 3
step '(cd web && npx vitest run src/engine/properties.test.ts 2>/dev/null | grep -E "Tests ")' 3
step "printf '{\"tool_name\":\"fs_write\",\"tool_input\":{\"path\":\"data/inhibitors.json\"}}' | node scripts/kiro-guard-clinical-data.mjs; echo \"exit=\$?\"" 5

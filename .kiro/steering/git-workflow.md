# Git workflow

- **Work on `dev`.** Commit and push to `dev` directly; no PR needed.
- **Never push to `main`.** `main` changes only through a pull request from `dev`.
  - `gh pr create --base main --head dev --fill`, then merge it on GitHub.
- Before the 8 PM submission, merge `dev` into `main` through a PR. Judges read `main`.
- Never force-push either branch.
- After cloning, run `git config core.hooksPath .githooks` once. The pre-push hook
  then blocks accidental pushes to `main`.

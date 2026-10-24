Read .plans/rxgene-architecture-spec.md sections 1, 2 and 7.

The Vite react-ts app in web/ was just scaffolded, and tailwindcss, @tailwindcss/vite, motion, lucide-react, vitest and @types/node are installed. Configure it. Don't install packages and don't run commands.

1. web/vite.config.ts: plugins react() and tailwindcss(); alias "@" -> ./src (use path.resolve); a Vitest `test` block with environment "node".
2. web/tsconfig.json and web/tsconfig.app.json: compilerOptions.baseUrl "." and paths {"@/*": ["./src/*"]}. Also enable resolveJsonModule in tsconfig.app.json.
3. web/src/index.css: replace the contents with `@import "tailwindcss";`
4. web/package.json scripts: add "sync-data" that copies ../data/cpic to src/data/cpic and ../data/inhibitors.json to src/data/inhibitors.json. Use a tiny Node script at web/scripts/sync-data.mjs (fs.cpSync, no dependencies). Run it from "predev", "prebuild" and "pretest". Add "test": "vitest run".
5. web/.gitignore: add src/data/cpic/ and src/data/inhibitors.json. Don't ignore src/data/patients.ts.

When you finish, list every file you changed.

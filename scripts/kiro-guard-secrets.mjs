#!/usr/bin/env node

/**
 * kiro-guard-secrets.mjs
 *
 * Kiro CLI 2.x does not support .kiroignore (that's a CLI V3/IDE-only feature - confirmed
 * against kiro.dev/docs/kiroignore, and empirically: Kiro read and printed the real
 * web/.env contents verbatim before this guard existed). This PreToolUse "read" hook is
 * the substitute for CLI 2.x: it blocks reads of env files and key/cert material the same
 * way kiro-guard-clinical-data.mjs blocks writes to clinical data.
 */

const protectedPatterns = [
  /(^|\/)\.env$/,
  /(^|\/)\.env\.[^.]+$/,
  /\.pem$/,
  /\.key$/,
  /\.p12$/
];

const allowedExceptions = [
  /\.env\.example$/
];

function isPathProtected(filePath) {
  if (!filePath) return false;
  const normalized = filePath.replace(/\\/g, '/');
  if (allowedExceptions.some(p => p.test(normalized))) return false;
  return protectedPatterns.some(p => p.test(normalized));
}

function extractPathFromHookInput(hookInput) {
  if (hookInput?.path) return hookInput.path;
  if (Array.isArray(hookInput?.operations) && hookInput.operations.length > 0) {
    return hookInput.operations[0].path;
  }
  return null;
}

async function main() {
  try {
    let input = '';
    if (!process.stdin.isTTY) {
      for await (const chunk of process.stdin) input += chunk.toString();
    }
    if (!input.trim()) process.exit(0);

    let hookData;
    try {
      hookData = JSON.parse(input);
    } catch (e) {
      console.error(`[guard-secrets] Invalid JSON input: ${e.message}`);
      process.exit(0);
    }

    const targetPath = extractPathFromHookInput(hookData.tool_input);
    if (!targetPath) process.exit(0);

    console.error(`[guard-secrets] Checking path: ${targetPath}`);

    if (isPathProtected(targetPath)) {
      console.error('Blocked: this file holds secrets (API keys/credentials). Kiro never reads .env, .pem, .key or .p12 files.');
      process.exit(2);
    }

    process.exit(0);
  } catch (error) {
    console.error(`[guard-secrets] Unexpected error: ${error.message}`);
    process.exit(0);
  }
}

main();

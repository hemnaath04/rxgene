#!/usr/bin/env node

/**
 * kiro-guard-clinical-data.mjs
 * 
 * Prevents Kiro from editing clinical data files and expected outputs.
 * Reads hook JSON from stdin, checks the target file path, and blocks
 * writes to CPIC data, inhibitors.json, and test fixtures.
 */

import fs from 'fs';

// Protected paths: data sources and expected outputs that belong to the genetics reviewer
const protectedPatterns = [
  'data/cpic/',
  'data/inhibitors.json',
  'tests/fixtures/'
];

function isPathProtected(filePath) {
  if (!filePath) return false;
  
  return protectedPatterns.some(pattern => {
    // Check if the path starts with or contains the protected pattern
    const normalized = filePath.replace(/\\/g, '/');
    return normalized.includes(pattern);
  });
}

function extractPathFromHookInput(hookInput) {
  // Try tool_input.path first (used by file write tools)
  if (hookInput?.path) {
    return hookInput.path;
  }
  
  // Fall back to operations[0].path (used by batch operations)
  if (hookInput?.operations && Array.isArray(hookInput.operations) && hookInput.operations.length > 0) {
    return hookInput.operations[0].path;
  }
  
  return null;
}

async function main() {
  try {
    // Read hook JSON from stdin
    let input = '';
    
    // Check if stdin is a TTY; if not, read from it
    if (!process.stdin.isTTY) {
      for await (const chunk of process.stdin) {
        input += chunk.toString();
      }
    }
    
    if (!input.trim()) {
      // No input; allow the tool
      process.exit(0);
    }
    
    let hookData;
    try {
      hookData = JSON.parse(input);
    } catch (e) {
      // Invalid JSON; log and allow
      console.error(`[guard] Invalid JSON input: ${e.message}`);
      process.exit(0);
    }
    
    // Extract the file path from the hook input
    const toolInput = hookData.tool_input;
    const targetPath = extractPathFromHookInput(toolInput);
    
    if (!targetPath) {
      // No path found; allow the tool
      process.exit(0);
    }
    
    // Log what we received for debugging
    console.error(`[guard] Checking path: ${targetPath}`);
    
    // Check if the path is protected
    if (isPathProtected(targetPath)) {
      console.error('Blocked: clinical data and expected outputs are owned by the genetics reviewer (Ananya). Change the engine, not the data.');
      process.exit(2);
    }
    
    // Path is not protected; allow the tool
    process.exit(0);
    
  } catch (error) {
    console.error(`[guard] Unexpected error: ${error.message}`);
    process.exit(0); // Allow on error to avoid breaking the workflow
  }
}

main();

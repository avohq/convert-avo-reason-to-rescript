#!/usr/bin/env node
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get proper filename in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputFile = process.argv[2];

// Validate input
if (!inputFile) {
  console.error("Usage: node resfmt-in-place.js filename.re");
  process.exit(1);
}

if (!fs.existsSync(inputFile)) {
  console.error(`Error: File ${inputFile} not found`);
  process.exit(1);
}

if (!inputFile.endsWith(".re")) {
  console.error("Error: File must have .re extension");
  process.exit(1);
}

// Add this constant at the top of the file
const HYPHEN_PLACEHOLDER = 'MyAmazingHyphen';

try {
  console.log("Installing rescript@9...");

  // Read and preprocess the file content
  let content = fs.readFileSync(inputFile, 'utf8');
  
  // Replace hyphens in bs.as clauses
  content = content.replace(/(@bs\.as\s*["'])([^"']*-[^"']*)(['"])/g, 
    (match, prefix, middle, suffix) => {
      return prefix + middle.replace(/-/g, HYPHEN_PLACEHOLDER) + suffix;
    }
  );
  
  // Write back to original file
  fs.writeFileSync(inputFile, content);
  console.log("Preprocessed file saved with hyphen placeholders");

  // Run converter directly on the file
  execSync(
    `npx -y rescript@9 convert "${inputFile}"`,
    {
      timeout: 30000,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }
  );

  // Clear the "Installing" message
  process.stdout.write("\x1b[1A\x1b[K");

  // Read the converted .res file
  const outputFile = inputFile.replace(/\.re$/, ".res");
  if (!fs.existsSync(outputFile)) {
    throw new Error(`Conversion failed: ${outputFile} was not created`);
  }

  let formattedContent = fs.readFileSync(outputFile, 'utf8');
  console.log(`Read converted file: ${outputFile}`);

  // Restore hyphens in the formatted content
  const restoredContent = formattedContent.replace(
    new RegExp(HYPHEN_PLACEHOLDER, 'g'), 
    '-'
  );

  // Write the restored content back
  fs.writeFileSync(outputFile, restoredContent);
  console.log("Restored hyphens in converted file");

  console.log(
    `[OK] ${path.basename(inputFile)} > ${path.basename(outputFile)}`
  );
} catch (error) {
  // Clear the "Installing" message
  process.stdout.write("\x1b[1A\x1b[K");

  if (error.code === "ETIMEDOUT") {
    console.error(
      "\x1b[31mError:\x1b[0m npx command timed out after 30 seconds. This may indicate a stuck prompt."
    );
  } else {
    console.error(
      "\x1b[31mError:\x1b[0m Failed to format file. This might be due to:"
    );
    console.error("  1. Invalid characters in the source file");
    console.error("  2. Syntax errors in the ReScript code");
    console.error("  3. Incompatible ReScript syntax version");
    console.error("\nError details:");
    console.error(error.stderr?.toString() || error.message);
  }
  process.exit(1);
}

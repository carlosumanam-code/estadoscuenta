#!/usr/bin/env node
// Postinstall script to completely disable pdf.js workers
// This prevents "Setting up fake worker failed" errors in serverless environments

const fs = require('fs');
const path = require('path');

const pdfjsFile = path.join(__dirname, '..', 'node_modules', 'pdf-parse', 'lib', 'pdf.js', 'v1.10.100', 'build', 'pdf.js');

try {
  if (!fs.existsSync(pdfjsFile)) {
    console.log('pdf.js not found at:', pdfjsFile);
    console.log('Skipping patch - pdf-parse may not be installed yet.');
    process.exit(0);
  }

  let content = fs.readFileSync(pdfjsFile, 'utf8');

  // Check if already patched
  if (content.includes('COMPLETELY DISABLE WORKER LOADING')) {
    console.log('✅ pdf.js already patched (workers disabled)');
    process.exit(0);
  }

  // Find the fakeWorkerFilesLoader assignment and replace it entirely
  // This is the pattern that causes issues in serverless
  const patterns = [
    // Pattern 1: Original pattern
    /fakeWorkerFilesLoader\s*=\s*useRequireEnsure\s*\?[\s\S]*?:\s*null;/,
    // Pattern 2: Already partially patched
    /fakeWorkerFilesLoader\s*=\s*function[\s\S]*?};\s*\n\s*\}/,
    // Pattern 3: Any fakeWorkerFilesLoader assignment
    /fakeWorkerFilesLoader\s*=[\s\S]*?;\s*\n\s*\}/
  ];

  const replacement = `// COMPLETELY DISABLE WORKER LOADING - this prevents serverless deployment errors
  // Workers are not needed for basic PDF text extraction
  fakeWorkerFilesLoader = null;
  workerSrc = ''`;

  let patched = false;
  for (const pattern of patterns) {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      patched = true;
      break;
    }
  }

  if (!patched) {
    console.warn('Warning: Could not find fakeWorkerFilesLoader pattern to patch');
    console.warn('The PDF extraction may still work if pdf-parse options disable workers');
    process.exit(0);
  }

  fs.writeFileSync(pdfjsFile, content);
  console.log('✅ pdf.js patched successfully - workers completely disabled');

} catch (error) {
  console.warn('Warning: Could not patch pdf.js:', error.message);
  console.warn('The application will still work with runtime worker disabling.');
  process.exit(0); // Don't fail the install
}

#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const profile = process.argv[2] || 'joveo';
const rootDir = path.resolve(__dirname, '..');
const contextFile = path.join(rootDir, '.cursor', 'project-context.md');

function isoNow() {
  return new Date().toISOString();
}

function replaceOnce(content, regex, replacement) {
  return content.replace(regex, (match) => replacement);
}

function updateForJoveo(content) {
  let updated = content;

  // Update last updated timestamp
  updated = replaceOnce(
    updated,
    /- \*\*Last Updated\*\*: `[^`]*`/,
    `- **Last Updated**: \`${isoNow()}\``
  );

  // Enforce Joveo styling preference
  updated = updated.replace(
    /- \*\*Preferred Styling\*\*: .*\n/,
    '- **Preferred Styling**: joveo_tokens (strict design tokens, no gradients)\n'
  );

  // Flip profile flags in Context Evolution Tracking
  updated = updated.replace(/"joveo-ai-dashboard"\s*:\s*\d+/g, '"joveo-ai-dashboard": 1');
  updated = updated.replace(/"default"\s*:\s*\d+/g, '"default": 0');

  // Ensure domain preferred components include charts/tables/metrics
  updated = updated.replace(
    /(\"preferred_components\"\s*:\s*\[)([^\]]*)(\])/,
    (m, p1, p2, p3) => {
      const base = '"data_grids", "dashboard_cards", "charts", "analytics_tables"';
      return `${p1}${base}${p3}`;
    }
  );

  return updated;
}

function main() {
  if (!fs.existsSync(contextFile)) {
    console.error(`Context file not found: ${contextFile}`);
    process.exit(1);
  }

  const original = fs.readFileSync(contextFile, 'utf8');
  let next = original;

  if (profile === 'joveo') {
    next = updateForJoveo(next);
  } else if (profile === 'default') {
    // Minimal default flip
    next = next.replace(/"joveo-ai-dashboard"\s*:\s*\d+/g, '"joveo-ai-dashboard": 0');
    next = next.replace(/"default"\s*:\s*\d+/g, '"default": 1');
    next = next.replace(
      /- \*\*Preferred Styling\*\*: .*\n/,
      '- **Preferred Styling**: professional_gradients\n'
    );
    next = next.replace(
      /- \*\*Last Updated\*\*: `[^`]*`/,
      `- **Last Updated**: \`${isoNow()}\``
    );
  }

  if (next !== original) {
    fs.writeFileSync(contextFile, next, 'utf8');
    console.log(`Updated ${path.relative(rootDir, contextFile)} for profile: ${profile}`);
  } else {
    console.log(`No changes needed for ${path.relative(rootDir, contextFile)} (profile: ${profile})`);
  }
}

main();



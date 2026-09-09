import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

/**
 * Compare measured gzip sizes against their budgets.
 *
 * A budgeted entry that was not built counts as infinitely over: renaming or
 * dropping a bundle must fail the gate rather than quietly satisfy it.
 */
export function checkSizes(budgets, measured) {
  const over = [];
  for (const [entry, budget] of Object.entries(budgets)) {
    const actual = entry in measured ? measured[entry] : Infinity;
    if (actual > budget) over.push({ entry, budget, actual });
  }
  return over;
}

function gzipSize(file) {
  try {
    return gzipSync(readFileSync(file)).length;
  } catch {
    return null;
  }
}

function main() {
  const { budgets } = JSON.parse(readFileSync('size-budget.json', 'utf8'));

  const measured = {};
  for (const entry of Object.keys(budgets)) {
    const size = gzipSize(entry);
    if (size !== null) measured[entry] = size;
  }

  const over = checkSizes(budgets, measured);
  const width = Math.max(...Object.keys(budgets).map((k) => k.length));

  console.log('\n  ' + 'bundle'.padEnd(width + 2) + 'gzipped'.padStart(9) + 'budget'.padStart(11));
  console.log('  ' + '-'.repeat(width + 22));
  for (const [entry, budget] of Object.entries(budgets)) {
    const actual = measured[entry];
    const shown = actual === undefined ? 'MISSING' : `${actual} B`;
    const flag = over.some((row) => row.entry === entry) ? '  OVER' : '';
    console.log(
      '  ' + entry.padEnd(width + 2) + shown.padStart(9) + `${budget} B`.padStart(11) + flag,
    );
  }
  console.log();

  if (over.length) {
    for (const row of over) {
      const actual = row.actual === Infinity ? 'not built' : `${row.actual} B`;
      console.error(`  ${row.entry}: ${actual}, budget ${row.budget} B`);
    }
    console.error(
      '\n  Over budget. Either make it smaller, or raise the ceiling in\n' +
        '  size-budget.json in this same PR and say why in the changeset.\n',
    );
    process.exit(1);
  }
}

// Only run the CLI when invoked directly, so the test can import the function.
if (process.argv[1] && process.argv[1].endsWith('size-check.mjs')) main();

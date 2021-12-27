// modified from https://github.com/Uniswap/merkle-distributor/blob/master/scripts/generate-merkle-root.ts
import {program} from 'commander';
import fs from 'fs';
import {parseBalanceMap} from '../../src/parse-balance-map';

program
  .version('0.0.0')
  .requiredOption(
    '-i, --input <path>',
    'input JSON file location containing a map of account addresses to string balances'
  )
  .requiredOption('-o, --output <filename>', 'output JSON filename');

program.parse(process.argv);
const options = program.opts();

const json = JSON.parse(fs.readFileSync(options.input, {encoding: 'utf8'}));

if (typeof json !== 'object') throw new Error('Invalid JSON');
let resultJson = JSON.stringify(parseBalanceMap(json), null, 2);
fs.writeFileSync(options.output, resultJson);

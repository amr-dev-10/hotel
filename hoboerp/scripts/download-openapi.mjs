import {mkdir, writeFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';

const [
  ,
  ,
  source = 'http://127.0.0.1:8000/openapi.json',
  output = 'src/types/generated/openapi.json',
] = process.argv;

const response = await fetch(source, {
  headers: {
    Accept: 'application/json',
  },
});

if (!response.ok) {
  throw new Error(
    `Unable to download OpenAPI schema from ${source}: HTTP ${response.status}`,
  );
}

const schema = await response.json();
const outputPath = resolve(output);
await mkdir(dirname(outputPath), {recursive: true});
await writeFile(outputPath, `${JSON.stringify(schema, null, 2)}\n`);

console.log(`Saved OpenAPI schema to ${output}`);

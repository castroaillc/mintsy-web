#!/usr/bin/env node
// Publishes an EAS update with the variant set: `eas update` doesn't read eas.json's env, and without APP_VARIANT it
// resolves the development config, so the update lands on a runtime no preview or production build has.
//   pnpm run update:preview "<message>"
//   pnpm run update:production "<message>"
// Those are package.json scripts, which are a fingerprint input: changing them changes every variant's runtime, so only
// do it alongside a new native build.
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function updateCommand(variant, message) {
  if (!['preview', 'production'].includes(variant)) throw new Error('Variant must be preview or production.');
  if (!message?.trim()) throw new Error('A message is required.');
  return {
    env: { APP_VARIANT: variant },
    args: ['eas-cli@latest', 'update', '--channel', variant, '--environment', variant, '--platform', 'ios', '--message', message],
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { env, args } = updateCommand(process.argv[2], process.argv.slice(3).join(' '));
    const { status } = spawnSync('npx', args, { stdio: 'inherit', env: { ...process.env, ...env } });
    process.exit(status ?? 1);
  } catch (err) {
    console.error(`${err.message}\nUsage: pnpm run update:<preview|production> "<message>"`);
    process.exit(1);
  }
}

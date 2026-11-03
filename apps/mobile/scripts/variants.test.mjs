// The three app variants and the update wrapper. Plain Node (run with `pnpm test`).
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { updateCommand } from './eas-update.mjs';

let run = 0;
async function configFor(appVariant) {
  if (appVariant === undefined) delete process.env.APP_VARIANT;
  else process.env.APP_VARIANT = appVariant;
  const { default: config } = await import(`../app.config.ts?run=${run++}`);
  return config({ config: {} });
}
const devClientPlugin = (config) => config.plugins.find((p) => Array.isArray(p) && p[0] === 'expo-dev-client');

const EXPECTED = {
  development: ['Mintsy Dev', 'com.getmintsy.app.dev', 'mintsy-dev'],
  preview: ['Mintsy Preview', 'com.getmintsy.app.preview', 'mintsy-preview'],
  production: ['Mintsy', 'com.getmintsy.app', 'mintsy'],
};

for (const [variant, [name, bundleId, scheme]] of Object.entries(EXPECTED)) {
  test(`${variant} has its own identity`, async () => {
    const config = await configFor(variant);
    assert.deepEqual(
      [config.name, config.ios.bundleIdentifier, config.android.package, config.scheme, config.extra.appVariant],
      [name, bundleId, bundleId, scheme, variant],
    );
  });
}

test('a missing APP_VARIANT is development, and an unknown one fails', async () => {
  assert.equal((await configFor(undefined)).name, 'Mintsy Dev');
  assert.equal((await configFor('')).name, 'Mintsy Dev');
  await assert.rejects(configFor('prod'), /Unknown APP_VARIANT "prod"/);
});

test('only production keeps the original icons; the others differ from it and each other', async () => {
  const icons = [];
  for (const variant of Object.keys(EXPECTED)) icons.push(await configFor(variant));
  assert.equal(icons[2].icon, './assets/images/icon.png');
  assert.equal(icons[2].android.adaptiveIcon.foregroundImage, './assets/images/android-icon-foreground.png');
  assert.equal(new Set(icons.map((c) => c.icon)).size, 3);
  assert.equal(new Set(icons.map((c) => c.android.adaptiveIcon.foregroundImage)).size, 3);
});

test('the dev client scheme is claimed only by development', async () => {
  assert.equal(devClientPlugin(await configFor('development'))[1].addGeneratedScheme, true);
  assert.equal(devClientPlugin(await configFor('preview'))[1].addGeneratedScheme, false);
  assert.equal(devClientPlugin(await configFor('production'))[1].addGeneratedScheme, false);
});

test('the update aliases publish through the script with the right variant', async () => {
  const { default: pkg } = await import('../package.json', { with: { type: 'json' } });
  assert.equal(pkg.scripts['update:preview'], 'node scripts/eas-update.mjs preview');
  assert.equal(pkg.scripts['update:production'], 'node scripts/eas-update.mjs production');
});

test('updates always carry a matching variant, channel and environment', () => {
  for (const variant of ['preview', 'production']) {
    const { env, args } = updateCommand(variant, 'Fix the thing');
    assert.equal(env.APP_VARIANT, variant);
    assert.equal(args[args.indexOf('--channel') + 1], variant);
    assert.equal(args[args.indexOf('--environment') + 1], variant);
    assert.equal(args[args.indexOf('--message') + 1], 'Fix the thing');
  }
  assert.throws(() => updateCommand('development', 'x'));
  assert.throws(() => updateCommand(undefined, 'x'));
  assert.throws(() => updateCommand('preview', ' '));
});

const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativewind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Shared packages live outside this app's workspace root.
config.watchFolders = [...(config.watchFolders ?? []), path.resolve(__dirname, '../../packages')];

module.exports = withNativewind(config, { inlineRem: 16 });

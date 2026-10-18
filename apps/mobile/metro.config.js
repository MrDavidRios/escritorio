const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')

// Expo configures Metro for the monorepo itself (workspace packages such as
// @escritorio/core resolve as TS source); don't add watchFolders here.
const config = getDefaultConfig(__dirname)

module.exports = withNativeWind(config, { input: './global.css' })

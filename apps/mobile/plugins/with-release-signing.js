const { withAppBuildGradle } = require("expo/config-plugins");

const SIGNING_MARKER = "// Solana Android Hub release signing";

function withReleaseSigning(config) {
  return withAppBuildGradle(config, (buildConfig) => {
    if (buildConfig.modResults.language !== "groovy") {
      throw new Error("Dapport release signing requires a Groovy app build.gradle");
    }

    buildConfig.modResults.contents = configureReleaseSigning(buildConfig.modResults.contents);
    return buildConfig;
  });
}

function configureReleaseSigning(contents) {
  if (contents.includes(SIGNING_MARKER)) return contents;

  const androidBlock = "android {";
  if (!contents.includes(androidBlock)) {
    throw new Error("Could not locate the Android Gradle block for release signing");
  }

  const signingConfigs = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }`;

  if (!contents.includes(signingConfigs)) {
    throw new Error("Could not locate Expo's default Android signing configuration");
  }

  const releaseSigning = `        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`;

  if (!contents.includes(releaseSigning)) {
    throw new Error("Could not locate Expo's default release signing assignment");
  }

  const signingEnvironment = `${SIGNING_MARKER}
def hubReleaseStoreFile = System.getenv("HUB_RELEASE_STORE_FILE")
def hubReleaseStorePassword = System.getenv("HUB_RELEASE_STORE_PASSWORD")
def hubReleaseKeyAlias = System.getenv("HUB_RELEASE_KEY_ALIAS")
def hubReleaseKeyPassword = System.getenv("HUB_RELEASE_KEY_PASSWORD")
def hubReleaseSigningConfigured = [
    hubReleaseStoreFile,
    hubReleaseStorePassword,
    hubReleaseKeyAlias,
    hubReleaseKeyPassword,
].every { value -> value != null && !value.isEmpty() }
def hubReleaseSigningRequired = (System.getenv("APP_ENV") ?: "local") == "production"

if (hubReleaseSigningRequired && !hubReleaseSigningConfigured) {
    throw new GradleException("Production Android builds require all HUB_RELEASE_* signing variables")
}

`;

  const configuredSigning = `    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            if (hubReleaseSigningConfigured) {
                storeFile file(hubReleaseStoreFile)
                storePassword hubReleaseStorePassword
                keyAlias hubReleaseKeyAlias
                keyPassword hubReleaseKeyPassword
            }
        }
    }`;

  return contents
    .replace(androidBlock, `${signingEnvironment}${androidBlock}`)
    .replace(signingConfigs, configuredSigning)
    .replace(
      releaseSigning,
      `        release {
            signingConfig hubReleaseSigningConfigured ? signingConfigs.release : signingConfigs.debug`,
    );
}

module.exports = withReleaseSigning;
module.exports.configureReleaseSigning = configureReleaseSigning;

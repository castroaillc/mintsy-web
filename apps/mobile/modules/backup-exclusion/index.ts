import { requireOptionalNativeModule } from 'expo';

type BackupExclusionModule = { excludeFromBackup(uri: string): boolean };

// Optional: Android, web and dev builds made before this module was added don't have it
const native = requireOptionalNativeModule<BackupExclusionModule>('BackupExclusion');

/**
 * Excludes a file or folder from iCloud backup (iOS). Returns false where that isn't possible
 * (other platforms, or a build without the native module), so callers can treat it as best effort.
 */
export function excludeFromBackup(uri: string) {
  try {
    return native?.excludeFromBackup(uri) ?? false;
  } catch {
    return false;
  }
}

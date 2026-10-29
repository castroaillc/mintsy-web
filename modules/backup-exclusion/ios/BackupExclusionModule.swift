import ExpoModulesCore

/// Sets NSURLIsExcludedFromBackupKey, which expo-file-system doesn't expose. Apple's data storage
/// guidelines require re-downloadable content kept in Documents to be excluded from iCloud backup.
public final class BackupExclusionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("BackupExclusion")

    /// Excludes the file or folder at `uri` (a file:// URI) from backup. A folder's contents are excluded with it.
    /// Returns false when the URI isn't a local file or the flag couldn't be set.
    Function("excludeFromBackup") { (uri: String) -> Bool in
      guard var url = URL(string: uri), url.isFileURL else {
        return false
      }
      var values = URLResourceValues()
      values.isExcludedFromBackup = true
      do {
        try url.setResourceValues(values)
        return true
      } catch {
        return false
      }
    }
  }
}

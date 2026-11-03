Pod::Spec.new do |s|
  s.name           = 'BackupExclusion'
  s.version        = '1.0.0'
  s.summary        = 'Marks files and folders as excluded from iCloud backup (NSURLIsExcludedFromBackupKey).'
  s.description    = s.summary
  s.license        = 'UNLICENSED'
  s.author         = 'mintsy'
  s.homepage       = 'https://getmintsy.com'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end

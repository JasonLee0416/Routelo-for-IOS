Pod::Spec.new do |s|
  s.name           = 'AppleVisionOcr'
  s.version        = '1.0.0'
  s.summary        = 'On-device Apple Vision OCR bridge for Routelo receipts'
  s.description    = 'Wraps VNRecognizeTextRequest (ko-KR/en-US, .accurate) as an Expo module.'
  s.author         = ''
  s.homepage       = 'https://github.com/JasonLee0416/Routelo-for-IOS'
  s.platforms      = { :ios => '16.0' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end

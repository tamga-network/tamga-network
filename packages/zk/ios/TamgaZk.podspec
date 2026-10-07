require 'json'
package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'TamgaZk'
  s.version        = package['version']
  s.summary        = 'Zero-knowledge mdoc proofs on the device (Longfellow ZK) for wallets on Tamga Network'
  s.description    = 'Creates zero-knowledge proofs about ISO mdoc credentials on the phone; verification is @tamga-network/verifier/zk.'
  s.license        = 'Apache-2.0'
  s.author         = 'Tamga Network'
  s.homepage       = 'https://tamga.network'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/tamga-network/tamga-network.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '*.{h,swift}'
  s.public_header_files = 'TamgaZkProver.h'
  # scripts/build-ios.sh üretir (depoya girmez; macOS gerekir). xcframework yoksa scripts/pack-packages.mjs ios/'u pakete
  # KOYMAZ ve expo-module.config.json yalnız "android" der; varsa iOS ("apple") kendiliğinden eklenir.
  s.vendored_frameworks = 'TamgaZkProver.xcframework'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end

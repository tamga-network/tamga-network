Pod::Spec.new do |s|
  s.name           = 'TamgaKeys'
  s.version        = '0.1.0'
  s.summary        = 'Tamga Wallet hardware keys (Secure Enclave) and App Attest'
  s.description    = 'P-256 holder keys generated and used inside the Secure Enclave; App Attest device integrity.'
  s.license        = 'Apache-2.0'
  s.author         = 'Tamga Network'
  s.homepage       = 'https://tamga.network'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/tamga-network/tamga-network.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,swift}"
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end

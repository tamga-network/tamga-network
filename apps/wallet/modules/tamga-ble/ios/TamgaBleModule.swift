// Tamga Wallet — ISO/IEC 18013-5 §8.3.3.1.1 BLE taşıyıcısı, mdoc peripheral server mode (CoreBluetooth).
// Hizmet UUID'si cihaz tanıtımından (QR) gelir. Karakteristikler: State (yaz + bildir), Client2Server (yaz),
// Server2Client (bildir). Parçalama ve protokol JS'tedir; burada yalnız ham parçalar taşınır (base64).
import CoreBluetooth
import ExpoModulesCore
import Foundation

private let STATE_UUID = CBUUID(string: "00000001-A123-48CE-896B-4C76973373E6")
private let C2S_UUID = CBUUID(string: "00000002-A123-48CE-896B-4C76973373E6")
private let S2C_UUID = CBUUID(string: "00000003-A123-48CE-896B-4C76973373E6")

internal final class BleException: GenericException<String>, @unchecked Sendable {
  override var reason: String { "TamgaBle: \(param)" }
}

public final class TamgaBleModule: Module {
  private var peripheral: Peripheral?

  public func definition() -> ModuleDefinition {
    Name("TamgaBle")
    Events("onState", "onData", "onMtu", "onDisconnect", "onError")

    AsyncFunction("start") { (serviceUuid: String) in
      self.peripheral?.stop()
      let p = Peripheral(serviceUuid: CBUUID(string: serviceUuid)) { [weak self] name, body in
        self?.sendEvent(name, body)
      }
      self.peripheral = p
      p.start()
    }

    AsyncFunction("send") { (chunkB64: String) in
      guard let p = self.peripheral, let data = Data(base64Encoded: chunkB64) else {
        throw BleException("not started or bad chunk")
      }
      p.send(data)
    }

    AsyncFunction("stop") {
      self.peripheral?.stop()
      self.peripheral = nil
    }
  }
}

private final class Peripheral: NSObject, CBPeripheralManagerDelegate {
  private let serviceUuid: CBUUID
  private let emit: (String, [String: Any]) -> Void
  private var manager: CBPeripheralManager?
  private var state: CBMutableCharacteristic?
  private var s2c: CBMutableCharacteristic?
  private var central: CBCentral?
  private var queue: [Data] = []

  init(serviceUuid: CBUUID, emit: @escaping (String, [String: Any]) -> Void) {
    self.serviceUuid = serviceUuid
    self.emit = emit
  }

  func start() {
    manager = CBPeripheralManager(delegate: self, queue: nil)
  }

  func stop() {
    manager?.stopAdvertising()
    manager?.removeAllServices()
    manager = nil
    central = nil
    queue.removeAll()
  }

  func send(_ data: Data) {
    queue.append(data)
    flush()
  }

  private func flush() {
    guard let m = manager, let c = s2c else { return }
    while let next = queue.first {
      let ok = m.updateValue(next, for: c, onSubscribedCentrals: central.map { [$0] })
      if !ok { return }  // peripheralManagerIsReady ile devam
      queue.removeFirst()
    }
  }

  func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
    guard peripheral.state == .poweredOn else {
      if peripheral.state == .unauthorized || peripheral.state == .unsupported || peripheral.state == .poweredOff {
        emit("onError", ["reason": "bluetooth state \(peripheral.state.rawValue)"])
      }
      return
    }
    let state = CBMutableCharacteristic(
      type: STATE_UUID, properties: [.notify, .writeWithoutResponse], value: nil, permissions: [.writeable])
    let c2s = CBMutableCharacteristic(
      type: C2S_UUID, properties: [.writeWithoutResponse], value: nil, permissions: [.writeable])
    let s2c = CBMutableCharacteristic(type: S2C_UUID, properties: [.notify], value: nil, permissions: [])
    let service = CBMutableService(type: serviceUuid, primary: true)
    service.characteristics = [state, c2s, s2c]
    self.state = state
    self.s2c = s2c
    peripheral.add(service)
    peripheral.startAdvertising([CBAdvertisementDataServiceUUIDsKey: [serviceUuid]])
  }

  func peripheralManager(_ peripheral: CBPeripheralManager, central: CBCentral, didSubscribeTo characteristic: CBCharacteristic) {
    self.central = central
    // ATT MTU − 3 (iOS maximumUpdateValueLength zaten başlık düşülmüş değer)
    emit("onMtu", ["mtu": central.maximumUpdateValueLength + 3])
  }

  func peripheralManager(_ peripheral: CBPeripheralManager, central: CBCentral, didUnsubscribeFrom characteristic: CBCharacteristic) {
    emit("onDisconnect", [:])
  }

  func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveWrite requests: [CBATTRequest]) {
    for r in requests {
      guard let value = r.value else { continue }
      if r.characteristic.uuid == STATE_UUID, let b = value.first {
        emit("onState", ["state": Int(b)])  // 0x01 başla, 0x02 bitir
      } else if r.characteristic.uuid == C2S_UUID {
        emit("onData", ["chunk": value.base64EncodedString()])
      }
    }
  }

  func peripheralManagerIsReady(toUpdateSubscribers peripheral: CBPeripheralManager) {
    flush()
  }
}

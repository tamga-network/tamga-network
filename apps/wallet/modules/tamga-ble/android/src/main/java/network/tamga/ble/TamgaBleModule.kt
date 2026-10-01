// Tamga Wallet — ISO/IEC 18013-5 §8.3.3.1.1 BLE taşıyıcısı, mdoc peripheral server mode (Android GATT sunucusu).
// Hizmet UUID'si cihaz tanıtımından (QR). Karakteristikler: State (yaz + bildir), Client2Server (yaz), Server2Client (bildir).
// Parçalama ve protokol JS'tedir; burada yalnız ham parçalar taşınır (base64). İzinler: BLUETOOTH_ADVERTISE, BLUETOOTH_CONNECT.
package network.tamga.ble

import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothGattServer
import android.bluetooth.BluetoothGattServerCallback
import android.bluetooth.BluetoothGattService
import android.bluetooth.BluetoothManager
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.content.Context
import android.os.Build
import android.os.ParcelUuid
import android.util.Base64
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID
import java.util.concurrent.ConcurrentLinkedQueue

private val STATE_UUID: UUID = UUID.fromString("00000001-A123-48CE-896B-4C76973373E6")
private val C2S_UUID: UUID = UUID.fromString("00000002-A123-48CE-896B-4C76973373E6")
private val S2C_UUID: UUID = UUID.fromString("00000003-A123-48CE-896B-4C76973373E6")
private val CCCD_UUID: UUID = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")

@SuppressLint("MissingPermission") // izinler JS tarafında çalışma anında istenir
class TamgaBleModule : Module() {
  private var server: BluetoothGattServer? = null
  private var device: BluetoothDevice? = null
  private var s2c: BluetoothGattCharacteristic? = null
  private var advertiseCallback: AdvertiseCallback? = null
  private val queue = ConcurrentLinkedQueue<ByteArray>()
  @Volatile private var sending = false

  private val manager: BluetoothManager
    get() = (appContext.reactContext ?: throw CodedException("ERR_NO_CONTEXT", "no context", null))
      .getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager

  override fun definition() = ModuleDefinition {
    Name("TamgaBle")
    Events("onState", "onData", "onMtu", "onDisconnect", "onError")

    AsyncFunction("start") { serviceUuid: String -> start(UUID.fromString(serviceUuid)) }

    AsyncFunction("send") { chunkB64: String ->
      if (server == null) throw CodedException("ERR_NOT_STARTED", "not started", null)
      queue.add(Base64.decode(chunkB64, Base64.NO_WRAP))
      flush()
    }

    AsyncFunction("stop") { stop() }

    OnDestroy { stop() }
  }

  private fun start(serviceUuid: UUID) {
    stop()
    val adapter = manager.adapter ?: throw CodedException("ERR_NO_BLE", "Bluetooth not available", null)
    if (!adapter.isEnabled) throw CodedException("ERR_BLE_OFF", "Bluetooth is off", null)
    val ctx = appContext.reactContext!!
    val gatt = manager.openGattServer(ctx, callback) ?: throw CodedException("ERR_GATT", "GATT server", null)
    val state = BluetoothGattCharacteristic(
      STATE_UUID,
      BluetoothGattCharacteristic.PROPERTY_NOTIFY or BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE,
      BluetoothGattCharacteristic.PERMISSION_WRITE,
    ).apply { addDescriptor(cccd()) }
    val c2s = BluetoothGattCharacteristic(
      C2S_UUID,
      BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE,
      BluetoothGattCharacteristic.PERMISSION_WRITE,
    )
    val out = BluetoothGattCharacteristic(
      S2C_UUID,
      BluetoothGattCharacteristic.PROPERTY_NOTIFY,
      0,
    ).apply { addDescriptor(cccd()) }
    val service = BluetoothGattService(serviceUuid, BluetoothGattService.SERVICE_TYPE_PRIMARY)
    service.addCharacteristic(state)
    service.addCharacteristic(c2s)
    service.addCharacteristic(out)
    gatt.addService(service)
    server = gatt
    s2c = out
    val cb = object : AdvertiseCallback() {
      override fun onStartFailure(errorCode: Int) {
        sendEvent("onError", mapOf("reason" to "advertise failed: $errorCode"))
      }
    }
    advertiseCallback = cb
    adapter.bluetoothLeAdvertiser?.startAdvertising(
      AdvertiseSettings.Builder()
        .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
        .setConnectable(true)
        .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_MEDIUM)
        .build(),
      AdvertiseData.Builder().addServiceUuid(ParcelUuid(serviceUuid)).setIncludeDeviceName(false).build(),
      cb,
    ) ?: throw CodedException("ERR_ADVERTISE", "BLE advertising not supported", null)
  }

  private fun stop() {
    try {
      advertiseCallback?.let { manager.adapter?.bluetoothLeAdvertiser?.stopAdvertising(it) }
    } catch (_: Exception) {}
    advertiseCallback = null
    server?.close()
    server = null
    device = null
    queue.clear()
    sending = false
  }

  private fun cccd() = BluetoothGattDescriptor(
    CCCD_UUID,
    BluetoothGattDescriptor.PERMISSION_READ or BluetoothGattDescriptor.PERMISSION_WRITE,
  )

  /** Bildirimler sırayla: bir sonraki onNotificationSent geldikten sonra. */
  private fun flush() {
    if (sending) return
    val d = device ?: return
    val c = s2c ?: return
    val next = queue.poll() ?: return
    sending = true
    if (Build.VERSION.SDK_INT >= 33) {
      server?.notifyCharacteristicChanged(d, c, false, next)
    } else {
      @Suppress("DEPRECATION")
      c.value = next
      @Suppress("DEPRECATION")
      server?.notifyCharacteristicChanged(d, c, false)
    }
  }

  private val callback = object : BluetoothGattServerCallback() {
    override fun onConnectionStateChange(dev: BluetoothDevice, status: Int, newState: Int) {
      if (newState == BluetoothGatt.STATE_CONNECTED) device = dev
      else if (newState == BluetoothGatt.STATE_DISCONNECTED) {
        device = null
        sendEvent("onDisconnect", mapOf<String, Any>())
      }
    }

    override fun onMtuChanged(dev: BluetoothDevice, mtu: Int) {
      sendEvent("onMtu", mapOf("mtu" to mtu))
    }

    override fun onCharacteristicWriteRequest(
      dev: BluetoothDevice, requestId: Int, characteristic: BluetoothGattCharacteristic,
      preparedWrite: Boolean, responseNeeded: Boolean, offset: Int, value: ByteArray?,
    ) {
      val v = value ?: ByteArray(0)
      when (characteristic.uuid) {
        STATE_UUID -> if (v.isNotEmpty()) sendEvent("onState", mapOf("state" to (v[0].toInt() and 0xff)))
        C2S_UUID -> sendEvent("onData", mapOf("chunk" to Base64.encodeToString(v, Base64.NO_WRAP)))
      }
      if (responseNeeded) server?.sendResponse(dev, requestId, BluetoothGatt.GATT_SUCCESS, 0, null)
    }

    override fun onDescriptorWriteRequest(
      dev: BluetoothDevice, requestId: Int, descriptor: BluetoothGattDescriptor,
      preparedWrite: Boolean, responseNeeded: Boolean, offset: Int, value: ByteArray?,
    ) {
      device = dev
      if (responseNeeded) server?.sendResponse(dev, requestId, BluetoothGatt.GATT_SUCCESS, 0, null)
    }

    override fun onNotificationSent(dev: BluetoothDevice, status: Int) {
      sending = false
      flush()
    }
  }
}

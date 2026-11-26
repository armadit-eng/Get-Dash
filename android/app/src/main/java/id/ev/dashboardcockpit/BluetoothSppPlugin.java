package id.ev.dashboardcockpit;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothSocket;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(
    name = "BluetoothSpp",
    permissions = {
        @Permission(
            alias = "bluetooth",
            strings = {
                Manifest.permission.BLUETOOTH_SCAN,
                Manifest.permission.BLUETOOTH_CONNECT,
                Manifest.permission.ACCESS_FINE_LOCATION
            }
        ),
        @Permission(
            alias = "bluetoothLegacy",
            strings = {
                Manifest.permission.BLUETOOTH,
                Manifest.permission.BLUETOOTH_ADMIN,
                Manifest.permission.ACCESS_FINE_LOCATION
            }
        )
    }
)
public class BluetoothSppPlugin extends Plugin {
    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private BluetoothSocket activeSocket;
    private OutputStream activeOut;
    private volatile boolean reading = false;
    private String connectedAddress = "";

    private BroadcastReceiver discoveryReceiver;
    private boolean receiverRegistered = false;

    private BluetoothAdapter getAdapter() {
        Context ctx = getContext();
        if (ctx == null) return BluetoothAdapter.getDefaultAdapter();
        BluetoothManager mgr = (BluetoothManager) ctx.getSystemService(Context.BLUETOOTH_SERVICE);
        return mgr != null ? mgr.getAdapter() : BluetoothAdapter.getDefaultAdapter();
    }

    private String requiredPermissionAlias() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? "bluetooth" : "bluetoothLegacy";
    }

    private boolean ensurePermissions(PluginCall call, String callbackName) {
        String alias = requiredPermissionAlias();
        if (getPermissionState(alias) != PermissionState.GRANTED) {
            requestPermissionForAlias(alias, call, callbackName);
            return false;
        }
        return true;
    }

    @PluginMethod
    public void isAvailable(PluginCall call) {
        BluetoothAdapter adapter = getAdapter();
        JSObject ret = new JSObject();
        ret.put("supported", adapter != null);
        ret.put("enabled", adapter != null && adapter.isEnabled());
        call.resolve(ret);
    }

    @PluginMethod
    public void getPairedDevices(PluginCall call) {
        if (!ensurePermissions(call, "onPermissionsForPaired")) return;
        resolvePairedDevices(call);
    }

    @PermissionCallback
    private void onPermissionsForPaired(PluginCall call) {
        if (getPermissionState(requiredPermissionAlias()) != PermissionState.GRANTED) {
            call.reject("Izin Bluetooth ditolak oleh pengguna.");
            return;
        }
        resolvePairedDevices(call);
    }

    @SuppressLint("MissingPermission")
    private void resolvePairedDevices(PluginCall call) {
        BluetoothAdapter adapter = getAdapter();
        if (adapter == null) {
            call.reject("Perangkat tidak memiliki adaptor Bluetooth.");
            return;
        }
        if (!adapter.isEnabled()) {
            call.reject("Bluetooth HP belum diaktifkan.");
            return;
        }

        JSArray list = new JSArray();
        Set<BluetoothDevice> bonded = adapter.getBondedDevices();
        if (bonded != null) {
            for (BluetoothDevice dev : bonded) {
                JSObject item = new JSObject();
                item.put("name", dev.getName() != null ? dev.getName() : dev.getAddress());
                item.put("address", dev.getAddress());
                item.put("type", dev.getType()); // 1=Classic, 2=BLE, 3=Dual
                item.put("isPaired", true);
                list.put(item);
            }
        }
        JSObject ret = new JSObject();
        ret.put("devices", list);
        call.resolve(ret);
    }

    @PluginMethod
    public void scanClassic(PluginCall call) {
        if (!ensurePermissions(call, "onPermissionsForScan")) return;
        startClassicDiscovery(call);
    }

    @PermissionCallback
    private void onPermissionsForScan(PluginCall call) {
        if (getPermissionState(requiredPermissionAlias()) != PermissionState.GRANTED) {
            call.reject("Izin scan Bluetooth ditolak.");
            return;
        }
        startClassicDiscovery(call);
    }

    @SuppressLint("MissingPermission")
    private void startClassicDiscovery(PluginCall call) {
        BluetoothAdapter adapter = getAdapter();
        if (adapter == null || !adapter.isEnabled()) {
            call.reject("Bluetooth tidak aktif.");
            return;
        }

        unregisterDiscoveryReceiver();
        if (adapter.isDiscovering()) {
            adapter.cancelDiscovery();
        }

        final JSArray foundDevices = new JSArray();
        discoveryReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                String action = intent.getAction();
                if (BluetoothDevice.ACTION_FOUND.equals(action)) {
                    BluetoothDevice dev = intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE);
                    short rssi = intent.getShortExtra(BluetoothDevice.EXTRA_RSSI, (short) -70);
                    if (dev != null && dev.getAddress() != null) {
                        JSObject item = new JSObject();
                        item.put("name", dev.getName() != null ? dev.getName() : dev.getAddress());
                        item.put("address", dev.getAddress());
                        item.put("rssi", rssi);
                        item.put("type", dev.getType());
                        item.put("isPaired", dev.getBondState() == BluetoothDevice.BOND_BONDED);
                        foundDevices.put(item);
                        notifyListeners("sppDeviceFound", item);
                    }
                } else if (BluetoothAdapter.ACTION_DISCOVERY_FINISHED.equals(action)) {
                    unregisterDiscoveryReceiver();
                }
            }
        };

        IntentFilter filter = new IntentFilter();
        filter.addAction(BluetoothDevice.ACTION_FOUND);
        filter.addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED);
        getContext().registerReceiver(discoveryReceiver, filter);
        receiverRegistered = true;

        adapter.startDiscovery();

        mainHandler.postDelayed(() -> {
            try {
                if (adapter.isDiscovering()) adapter.cancelDiscovery();
            } catch (Exception ignored) {}
            unregisterDiscoveryReceiver();
            JSObject ret = new JSObject();
            ret.put("devices", foundDevices);
            call.resolve(ret);
        }, 5500);
    }

    private void unregisterDiscoveryReceiver() {
        if (receiverRegistered && discoveryReceiver != null && getContext() != null) {
            try {
                getContext().unregisterReceiver(discoveryReceiver);
            } catch (Exception ignored) {}
            receiverRegistered = false;
        }
    }

    @PluginMethod
    public void connect(PluginCall call) {
        if (!ensurePermissions(call, "onPermissionsForConnect")) return;
        connectInternal(call);
    }

    @PermissionCallback
    private void onPermissionsForConnect(PluginCall call) {
        if (getPermissionState(requiredPermissionAlias()) != PermissionState.GRANTED) {
            call.reject("Izin koneksi Bluetooth ditolak.");
            return;
        }
        connectInternal(call);
    }

    @SuppressLint("MissingPermission")
    private void connectInternal(PluginCall call) {
        String address = call.getString("address", "");
        if (address == null || address.isEmpty()) {
            call.reject("Alamat MAC perangkat SPP tidak boleh kosong.");
            return;
        }

        BluetoothAdapter adapter = getAdapter();
        if (adapter == null || !adapter.isEnabled()) {
            call.reject("Bluetooth tidak aktif.");
            return;
        }

        executor.execute(() -> {
            closeSocketInternal();
            try {
                if (adapter.isDiscovering()) {
                    adapter.cancelDiscovery();
                }
                BluetoothDevice device = adapter.getRemoteDevice(address);
                BluetoothSocket socket;
                try {
                    socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
                    socket.connect();
                } catch (IOException primaryErr) {
                    try {
                        Method m = device.getClass().getMethod("createRfcommSocket", int.class);
                        socket = (BluetoothSocket) m.invoke(device, 1);
                        socket.connect();
                    } catch (Exception fallbackErr) {
                        throw primaryErr;
                    }
                }

                activeSocket = socket;
                activeOut = socket.getOutputStream();
                connectedAddress = address;
                reading = true;

                JSObject res = new JSObject();
                res.put("connected", true);
                res.put("address", address);
                res.put("name", device.getName() != null ? device.getName() : address);
                call.resolve(res);

                startReadLoop(socket.getInputStream(), address);
            } catch (Exception e) {
                closeSocketInternal();
                call.reject("Gagal terhubung ke SPP " + address + ": " + e.getMessage());
            }
        });
    }

    private void startReadLoop(InputStream in, String address) {
        byte[] buffer = new byte[1024];
        StringBuilder lineBuf = new StringBuilder();
        while (reading && activeSocket != null) {
            try {
                int len = in.read(buffer);
                if (len < 0) break;
                if (len == 0) continue;

                StringBuilder hex = new StringBuilder(len * 2);
                for (int i = 0; i < len; i++) {
                    int b = buffer[i] & 0xFF;
                    hex.append(String.format("%02X", b));
                    char ch = (char) b;
                    if (ch == '\n' || ch == '\r') {
                        String line = lineBuf.toString().trim();
                        lineBuf.setLength(0);
                        if (!line.isEmpty()) {
                            JSObject ev = new JSObject();
                            ev.put("address", address);
                            ev.put("line", line);
                            notifyListeners("sppLine", ev);
                        }
                    } else if (b >= 32 && b < 127) {
                        if (lineBuf.length() < 512) lineBuf.append(ch);
                    }
                }

                JSObject bytesEv = new JSObject();
                bytesEv.put("address", address);
                bytesEv.put("hex", hex.toString());
                notifyListeners("sppBytes", bytesEv);
            } catch (IOException e) {
                break;
            }
        }
        closeSocketInternal();
        JSObject disc = new JSObject();
        disc.put("address", address);
        notifyListeners("sppDisconnected", disc);
    }

    @PluginMethod
    public void write(PluginCall call) {
        OutputStream out = activeOut;
        if (out == null) {
            call.reject("Koneksi SPP belum aktif.");
            return;
        }
        String text = call.getString("text");
        String hex = call.getString("hex");
        try {
            if (text != null) {
                out.write(text.getBytes(StandardCharsets.UTF_8));
                out.flush();
                call.resolve();
                return;
            }
            if (hex != null) {
                String clean = hex.replaceAll("[^0-9a-fA-F]", "");
                byte[] bytes = new byte[clean.length() / 2];
                for (int i = 0; i < bytes.length; i++) {
                    bytes[i] = (byte) Integer.parseInt(clean.substring(i * 2, i * 2 + 2), 16);
                }
                out.write(bytes);
                out.flush();
                call.resolve();
                return;
            }
            call.reject("Parameter text atau hex diperlukan.");
        } catch (IOException e) {
            call.reject("Gagal mengirim data SPP: " + e.getMessage());
        }
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        closeSocketInternal();
        call.resolve();
    }

    private void closeSocketInternal() {
        reading = false;
        connectedAddress = "";
        if (activeOut != null) {
            try { activeOut.close(); } catch (Exception ignored) {}
            activeOut = null;
        }
        if (activeSocket != null) {
            try { activeSocket.close(); } catch (Exception ignored) {}
            activeSocket = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        unregisterDiscoveryReceiver();
        closeSocketInternal();
        executor.shutdownNow();
        super.handleOnDestroy();
    }
}

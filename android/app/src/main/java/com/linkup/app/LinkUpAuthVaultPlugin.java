package com.linkup.app;

import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.AtomicFile;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Encrypted app-private storage; ciphertext is excluded from Android backups. */
@CapacitorPlugin(name = "LinkUpAuthVault")
public class LinkUpAuthVaultPlugin extends Plugin {
    private static final String ALIAS = "linkup.auth.v1";
    private AtomicFile file() { return new AtomicFile(new File(getContext().getNoBackupFilesDir(), "linkup-auth-v1")); }
    private byte[] aad() { return (getContext().getPackageName() + ":auth:v1").getBytes(StandardCharsets.UTF_8); }

    @PluginMethod public synchronized void read(PluginCall call) {
        AtomicFile storage = file();
        try {
            JSONObject envelope = new JSONObject(new String(storage.readFully(), StandardCharsets.UTF_8));
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key(false), new GCMParameterSpec(128, Base64.decode(envelope.getString("iv"), Base64.NO_WRAP)));
            cipher.updateAAD(aad());
            String value = new String(cipher.doFinal(Base64.decode(envelope.getString("data"), Base64.NO_WRAP)), StandardCharsets.UTF_8);
            call.resolve(new JSObject().put("value", value));
        } catch (java.io.FileNotFoundException absent) {
            call.resolve(new JSObject().put("value", JSONObject.NULL));
        } catch (Exception exception) {
            if (exception instanceof javax.crypto.AEADBadTagException || exception instanceof IllegalStateException
                    || exception instanceof org.json.JSONException || exception instanceof java.security.UnrecoverableKeyException
                    || exception instanceof android.security.keystore.KeyPermanentlyInvalidatedException) {
                // Restored/tampered ciphertext cannot be used with a different key.
                storage.delete(); call.resolve(new JSObject().put("value", JSONObject.NULL));
            } else {
                // Temporary disk/keystore failures must not erase a valid saved session.
                call.reject("Could not open saved sign-in. Please restart the app.");
            }
        }
    }
    @PluginMethod public synchronized void write(PluginCall call) {
        String value = call.getString("value");
        if (value == null || value.length() > 524288) { call.reject("Invalid saved sign-in."); return; }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) { call.reject("Secure sign-in requires Android 6 or later."); return; }
        AtomicFile storage = file(); FileOutputStream stream = null;
        try {
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding"); cipher.init(Cipher.ENCRYPT_MODE, key(true));
            cipher.updateAAD(aad());
            byte[] encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
            JSONObject envelope = new JSONObject().put("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
                    .put("data", Base64.encodeToString(encrypted, Base64.NO_WRAP));
            stream = storage.startWrite(); stream.write(envelope.toString().getBytes(StandardCharsets.UTF_8));
            storage.finishWrite(stream); call.resolve();
        } catch (Exception exception) {
            if (stream != null) storage.failWrite(stream);
            call.reject("Could not save sign-in securely. Please try again.");
        }
    }
    private SecretKey key(boolean create) throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
        if (store.containsAlias(ALIAS)) return (SecretKey) store.getKey(ALIAS, null);
        if (!create) throw new IllegalStateException("Saved sign-in key is unavailable.");
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256).build());
        return generator.generateKey();
    }
}

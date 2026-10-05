package com.linkup.app;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.util.Base64;
import androidx.core.content.FileProvider;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;

@CapacitorPlugin(name = "LinkUpSettings")
public class LinkUpSettingsPlugin extends Plugin {
    @PluginMethod
    public void copyText(PluginCall call) {
        String text = call.getString("text");
        if (text == null || text.length() > 4096) {
            call.reject("Invalid link.");
            return;
        }
        ClipboardManager clipboard = (ClipboardManager) getContext().getSystemService(Context.CLIPBOARD_SERVICE);
        if (clipboard == null) {
            call.reject("Clipboard unavailable.");
            return;
        }
        clipboard.setPrimaryClip(ClipData.newPlainText("LinkUp profile", text));
        call.resolve();
    }

    @PluginMethod
    public void shareLink(PluginCall call) {
        String url = call.getString("url", "");
        Uri parsed = Uri.parse(url);
        if (!"http".equals(parsed.getScheme()) && !"https".equals(parsed.getScheme())) {
            call.reject("Invalid profile link.");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_SEND);
        intent.setType("text/plain");
        intent.putExtra(Intent.EXTRA_SUBJECT, call.getString("title", "LinkUp"));
        intent.putExtra(Intent.EXTRA_TEXT, call.getString("text", "") + "\n" + url);
        share(call, intent, "Share LinkUp profile");
    }

    @PluginMethod
    public void shareQr(PluginCall call) {
        String base64 = call.getString("base64", "");
        if (base64.isEmpty() || base64.length() > 2000000) {
            call.reject("Unable to prepare QR code.");
            return;
        }
        try {
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            Bitmap image = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            if (image == null) {
                call.reject("Unable to prepare QR code.");
                return;
            }
            File folder = new File(getContext().getCacheDir(), "linkup-share");
            if (!folder.exists() && !folder.mkdirs()) {
                call.reject("Unable to prepare QR code.");
                return;
            }
            File file = new File(folder, "linkup-profile-qr.png");
            try (FileOutputStream stream = new FileOutputStream(file)) {
                image.compress(Bitmap.CompressFormat.PNG, 100, stream);
            } finally {
                image.recycle();
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType("image/png");
            intent.putExtra(Intent.EXTRA_STREAM, uri);
            intent.setClipData(ClipData.newRawUri("LinkUp QR code", uri));
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            share(call, intent, "Share profile QR code");
        } catch (Exception exception) {
            call.reject("Unable to share QR code.", exception);
        }
    }

    @PluginMethod
    public void openExternal(PluginCall call) {
        Uri uri = Uri.parse(call.getString("url", ""));
        if (!"https".equals(uri.getScheme()) && !"mailto".equals(uri.getScheme())) {
            call.reject("Invalid link.");
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                getActivity().startActivity(new Intent(Intent.ACTION_VIEW, uri));
                call.resolve();
            } catch (Exception exception) {
                call.reject("No app is available to open this link.", exception);
            }
        });
    }

    private void share(PluginCall call, Intent intent, String title) {
        getActivity().runOnUiThread(() -> {
            try {
                getActivity().startActivity(Intent.createChooser(intent, title));
                call.resolve();
            } catch (Exception exception) {
                call.reject("Sharing is unavailable right now.", exception);
            }
        });
    }
}

package net.factorsaaz.offline.dev;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.UUID;

@CapacitorPlugin(name = "OfflinePdf")
public class OfflinePdfPlugin extends Plugin {
    private static final String MIME = "application/pdf";
    private static final int MAX_BASE64_SIZE = 64 * 1024 * 1024;

    private static String fileName(PluginCall call) {
        String name = call.getString("name", "");
        if (!name.endsWith(".pdf") || name.length() > 240 || name.indexOf('/') >= 0
            || name.indexOf('\\') >= 0 || name.chars().anyMatch(Character::isISOControl)) {
            throw new IllegalArgumentException("invalid_pdf_name");
        }
        return name;
    }

    private static byte[] pdf(PluginCall call) {
        String base64 = call.getString("base64", "");
        if (base64.length() > MAX_BASE64_SIZE || !base64.startsWith("JVBERi0")) {
            throw new IllegalArgumentException("invalid_pdf");
        }
        return Base64.decode(base64, Base64.NO_WRAP);
    }

    @PluginMethod
    public void savePdf(PluginCall call) {
        try {
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT)
                .addCategory(Intent.CATEGORY_OPENABLE)
                .setType(MIME)
                .putExtra(Intent.EXTRA_TITLE, fileName(call));
            startActivityForResult(call, intent, "saveResult");
        } catch (RuntimeException error) {
            call.reject("pdf_picker_failed", error);
        }
    }

    @ActivityCallback
    private void saveResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK) {
            call.resolve(new JSObject().put("saved", false));
            return;
        }
        Uri uri = result.getData() == null ? null : result.getData().getData();
        if (uri == null) {
            call.reject("pdf_destination_missing");
            return;
        }
        try {
            byte[] bytes = pdf(call);
            try (OutputStream output = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                if (output == null) throw new IOException("pdf_destination_unavailable");
                output.write(bytes);
            }
            call.resolve(new JSObject().put("saved", true));
        } catch (IOException | RuntimeException error) {
            call.reject("pdf_write_failed", error);
        }
    }

    @PluginMethod
    public void sharePdf(PluginCall call) {
        try {
            String name = fileName(call);
            byte[] bytes = pdf(call);
            File cache = new File(getContext().getCacheDir(), "offline-share");
            pruneShares(cache);
            File directory = new File(cache, UUID.randomUUID().toString());
            if (!directory.mkdirs()) throw new IOException("pdf_cache_unavailable");
            File file = new File(directory, name);
            try (FileOutputStream output = new FileOutputStream(file)) {
                output.write(bytes);
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            Intent send = new Intent(Intent.ACTION_SEND).setType(MIME)
                .putExtra(Intent.EXTRA_STREAM, uri)
                .setClipData(ClipData.newRawUri(name, uri))
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(Intent.createChooser(send, null));
            call.resolve();
        } catch (IOException | RuntimeException error) {
            call.reject("pdf_share_failed", error);
        }
    }

    private static void pruneShares(File cache) {
        File[] folders = cache.listFiles();
        if (folders == null) return;
        long cutoff = System.currentTimeMillis() - 24L * 60 * 60 * 1000;
        for (File folder : folders) {
            if (!folder.isDirectory() || folder.lastModified() >= cutoff) continue;
            File[] files = folder.listFiles();
            if (files == null) continue;
            for (File file : files) file.delete();
            folder.delete();
        }
    }
}

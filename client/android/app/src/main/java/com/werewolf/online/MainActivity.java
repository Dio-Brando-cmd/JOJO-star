package com.werewolf.online;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private DownloadManager downloadManager;
    private long downloadId;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            String ua = webView.getSettings().getUserAgentString();
            webView.getSettings().setUserAgentString(ua + " WerewolfApp/1.5.0");
            webView.getSettings().setAllowFileAccess(true);
            // 注入 JavaScript 接口，供前端调用原生下载功能
            webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");
        }
        downloadManager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
    }

    // JavaScript 可调用的原生接口
    public class AndroidBridge {
        @JavascriptInterface
        public void downloadAndInstall(String url, String fileName) {
            // 使用 Android DownloadManager 下载 APK
            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.setTitle("狼人杀更新");
            request.setDescription("正在下载最新版本...");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
            request.setMimeType("application/vnd.android.package-archive");

            downloadId = downloadManager.enqueue(request);

            // 监听下载完成，自动打开安装
            IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
            registerReceiver(new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    long id = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                    if (id == downloadId) {
                        // 下载完成，打开安装界面
                        Uri apkUri = downloadManager.getUriForDownloadedFile(downloadId);
                        if (apkUri != null) {
                            Intent installIntent = new Intent(Intent.ACTION_VIEW);
                            installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                            installIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                            startActivity(installIntent);
                        }
                    }
                }
            }, filter);
        }

        @JavascriptInterface
        public String getVersion() {
            return "1.5.0";
        }
    }
}

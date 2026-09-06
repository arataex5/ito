/* =========================================================
   pwa.js - Service Worker 登録
   http(s) 環境でのみ登録。file:// や Capacitor(APK) では
   ローカルアセットを直接読むためスキップする。
   ========================================================= */
(function () {
  'use strict';
  var proto = location.protocol;
  var canSW = ('serviceWorker' in navigator) && (proto === 'http:' || proto === 'https:');
  if (!canSW) return;

  window.addEventListener('load', function () {
    // 相対パスで登録（サブディレクトリ配置でも動作）
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .then(function (reg) {
        reg.addEventListener('updatefound', function () {
          var nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', function () {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              nw.postMessage('SKIP_WAITING');
            }
          });
        });
      })
      .catch(function () { /* 登録失敗してもアプリは動作する */ });

    var reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (reloaded) return;
      reloaded = true;
      location.reload();
    });
  });
})();

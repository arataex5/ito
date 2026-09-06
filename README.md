# ito（スマホ特化 PWA / APK化前提）

ボードゲーム「ito」用の補助アプリです。**スマートフォン専用**（iPhone / Android）で設計しています。

## ディレクトリ構成

```
ito-app/
├── index.html              メインHTML（全画面の構造）
├── manifest.json           PWAマニフェスト（display: standalone）
├── sw.js                   Service Worker（完全オフライン動作）
├── README.md
├── css/
│   └── style.css           スマホ用CSS（セーフエリア / Marquee / 向き切替 など）
├── js/
│   ├── app.js              画面遷移・状態管理・ゲームロジック
│   ├── data.js             CSV解析・埋め込みフォールバック・localStorage永続化
│   └── pwa.js              Service Worker 登録
├── data/
│   └── default_topics.csv  お題マスターデータ（60件）
└── icons/                  アイコン（192 / 512 / maskable / apple-touch）
```

すべてのアセットは **相対パス（`./`）** で参照しているため、サブディレクトリ配置・`file:///`・Capacitor のローカルスキームのいずれでも動作します。

## 動作確認（PWA）

ローカルサーバーで開いてください（`file://` でも動きますが、Service Worker は http(s) のみ有効です）。

```bash
cd ito-app
python3 -m http.server 8080
# スマホから http://<PCのIP>:8080/ を開く → 「ホーム画面に追加」
```

- 初回アクセス後は機内モードでも起動・全機能が動作します。
- お題・設定・プレイヤー名・履歴はすべて `localStorage` に保存されます。

## CSV について

`data/default_topics.csv` の書式：

| 列 | 内容 | 例 |
|----|------|-----|
| A | No. | `1` |
| B | お題 | `食べ物` |
| C | 評価 | `1:低カロリーな食べ物-100:高カロリーな食べ物` |
| D | マスターデータ | `1` または `true` → 編集・削除不可 |

- 起動時に `fetch('./data/default_topics.csv')` で読み込みます。
- **fetch に失敗した場合（`file://` 実行、APK のローカルスキーム、タイムアウト等）は `js/data.js` 内の `EMBEDDED_CSV` を自動的に使用**します。CSV を編集したときは `EMBEDDED_CSV` も合わせて更新してください（内容は同一です）。
- マスターデータはアプリ側から編集・削除できません。ユーザーが追加したお題のみ編集・削除でき、削除時は No. を自動で詰めます。

## Android APK 化（Capacitor）

```bash
npm init -y
npm i @capacitor/core @capacitor/cli @capacitor/android
npx cap init ito com.example.ito --web-dir=.        # ito-app 直下で実行
npx cap add android
npx cap copy
npx cap open android                                # Android Studio でビルド
```

`capacitor.config.json` の例：

```json
{
  "appId": "com.example.ito",
  "appName": "ito",
  "webDir": ".",
  "android": { "allowMixedContent": false },
  "server": { "androidScheme": "https" }
}
```

- APK では Service Worker を登録しません（`js/pwa.js` が http(s) 以外ではスキップします）。アセットはローカルから直接読み込まれるため、オフライン動作に影響はありません。
- 画面の向きは `manifest.json` の `orientation: "any"`＋アプリ内の「⟳」ボタンで切り替えます。Android の向き固定を行う場合は `AndroidManifest.xml` の `android:screenOrientation` を調整してください。

## 主な操作

| 画面 | 操作 |
|------|------|
| タイトル | 「お題を決める」/ 人数±・名前入力 / 最下部「数字だけ確認する」/ 左上「お題リスト」/ 右上「履歴」「設定」 |
| お題を選ぶ | カードをタップで1つ選択 →「決定」で使用済み＆履歴へ |
| 数字確認 | 画面タップ →「あなたは〇〇さんですか？」→ はい → 数字表示 →「次の人へ」 |
| お題表示 | 10文字ごとに自動改行。右上「次のお題へ」、右下「数字忘れちゃった」、「⟳」で横画面レイアウト |
| お題リスト | ♡ / No. / お題（長い場合は自動横スクロール）/ 除外チェック、検索・♡リスト・除外リスト |
| 履歴 | 使用順に一覧、右上ゴミ箱で確認なし削除、「表示する」でお題表示へ |
| 設定 | 抽出数 1〜10 / 数値範囲（最大4桁・左≦右）/ 使用済み除外 / お気に入り限定 / 除外の有効化 |

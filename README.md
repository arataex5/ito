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
│   └── default_topics.csv  お題マスターデータ（232件）
├── tools/
│   └── embed_csv.py        CSV → data.js 埋め込みデータ 再生成スクリプト
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

### お題データを差し替える手順

1. `data/default_topics.csv` を新しいCSVで上書き（列は上表のとおり。文字コードは UTF-8、BOM付きでも可）。
2. `python3 tools/embed_csv.py` を実行（`js/data.js` の埋め込みフォールバックが自動更新されます）。
3. `sw.js` の `APP_VERSION` を上げる（キャッシュを確実に更新するため）。

- 起動時に `fetch('./data/default_topics.csv')` で読み込みます。
- **fetch に失敗した場合（`file://` 実行、APK のローカルスキーム、タイムアウト等）は `js/data.js` 内の `EMBEDDED_CSV` を自動的に使用**します。CSV を編集したときは `EMBEDDED_CSV` も合わせて更新してください（内容は同一です）。
- マスターデータはアプリ側から編集・削除できません。ユーザーが追加したお題のみ編集・削除でき、削除時は No. を自動で詰めます。

## Android APK 化（Capacitor）手順

Web版（このフォルダ）をそのまま Android アプリとして包む方法です。所要時間は初回で 1〜2 時間程度（大半は Android Studio のインストール）。

### 0. 事前に用意するもの

| 必要なもの | 補足 |
|---|---|
| Node.js 18 以上 | https://nodejs.org （LTS版） |
| JDK 17 | Android Studio に同梱のものでOK |
| Android Studio | https://developer.android.com/studio |
| Android SDK | Android Studio の SDK Manager で「Android 14 (API 34)」以上＋「Android SDK Build-Tools」「Android SDK Platform-Tools」を入れる |

環境変数（Windows はシステム環境変数、mac は `~/.zshrc`）:

```
ANDROID_HOME = C:\Users\<ユーザー名>\AppData\Local\Android\Sdk   （mac: ~/Library/Android/sdk）
PATH に %ANDROID_HOME%\platform-tools を追加
```

### 1. プロジェクトを作る

```bash
mkdir ito-android && cd ito-android
npm init -y
npm i @capacitor/core
npm i -D @capacitor/cli
npx cap init "ito" "com.example.ito" --web-dir=www
```

- `"ito"` … アプリ名（ホーム画面に出る名前）
- `com.example.ito` … アプリID。自分のドメイン逆順が理想（例 `jp.arata.ito`）。**一度公開すると変更できません。**

### 2. Web資産を配置

`ito-app/` の中身（index.html, css/, js/, data/, icons/, manifest.json, sw.js）を、作成した `ito-android/www/` の直下にコピーします。

```
ito-android/
├── package.json
├── capacitor.config.json
└── www/
    ├── index.html
    ├── css/ js/ data/ icons/
    └── manifest.json, sw.js
```

`capacitor.config.json` は次のようにします。

```json
{
  "appId": "com.example.ito",
  "appName": "ito",
  "webDir": "www",
  "server": { "androidScheme": "https" },
  "android": { "allowMixedContent": false, "backgroundColor": "#0d0f1e" }
}
```

### 3. Android プロジェクトを追加

```bash
npm i @capacitor/android
npx cap add android
npx cap sync android
```

- 以降、`www/` を編集したら毎回 `npx cap sync android`（またはコピーだけなら `npx cap copy android`）を実行してください。
- 任意ですが、Androidの「戻る」ボタンをアプリ内の戻る操作にしたい場合は `npm i @capacitor/app` を入れてから `npx cap sync android`。本アプリは同プラグインがあれば自動で連携します（無ければ何もしません）。

### 4. アイコンとスプラッシュを作る（任意）

```bash
npm i -D @capacitor/assets
mkdir assets
# assets/icon.png（1024×1024）、assets/splash.png（2732×2732）を置く
npx capacitor-assets generate --android
```

`ito-app/icons/icon-512.png` を拡大して使ってもかまいません。

### 5. デバッグAPKを作る（実機で試す用）

Android Studio から:

```bash
npx cap open android
```

→ Android Studio が開いたら **Build ▸ Build Bundle(s) / APK(s) ▸ Build APK(s)**
→ 完成物: `android/app/build/outputs/apk/debug/app-debug.apk`

コマンドラインだけで作る場合:

```bash
cd android
./gradlew assembleDebug        # Windows は gradlew.bat assembleDebug
```

APKをスマホにコピーして開き、「提供元不明のアプリ」を許可すればインストールできます。USB接続なら `adb install -r app-debug.apk` でも可。

### 6. リリース用（署名付き）APKを作る

1) 署名鍵を作成（**このファイルとパスワードは必ず保管**。紛失するとアプリを更新できません）

```bash
keytool -genkey -v -keystore ito-release.keystore -alias ito -keyalg RSA -keysize 2048 -validity 10000
```

2) `android/key.properties` を作成

```
storePassword=<作成時のパスワード>
keyPassword=<作成時のパスワード>
keyAlias=ito
storeFile=../../ito-release.keystore
```

3) `android/app/build.gradle` に追記

```gradle
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false
        }
    }
}
```

4) ビルド

```bash
cd android
./gradlew assembleRelease      # → app/build/outputs/apk/release/app-release.apk
./gradlew bundleRelease        # Google Play 用の .aab が必要な場合
```

### 7. APK化にあたっての本アプリの挙動

- **Service Worker は自動で無効**になります（Capacitor 実行を検知）。アセットは端末内から直接読まれるため、オフライン動作に影響はありません。
- お題データは `https://localhost` スキームで配信されるため通常は CSV を `fetch` できます。読めない環境でも `js/data.js` の埋め込みデータへ自動フォールバックします。
- 追加・編集したお題、設定、履歴は `localStorage` に保存され、アプリを再起動しても残ります（アプリのデータ削除・アンインストールで消えます）。
- 画面の向きは自由。固定したい場合は `android/app/src/main/AndroidManifest.xml` の `<activity>` に `android:screenOrientation="portrait"` を追加。
- ステータスバーの色を変えたい場合は `npm i @capacitor/status-bar`。

### 補足：もっと手軽な方法（PWA配布）

APKを作らず、GitHub Pages や Netlify に `ito-app/` をそのまま置き、スマホのブラウザで開いて「ホーム画面に追加」でも、全画面・オフラインで同じように動きます。まず試すならこちらが最短です。

## 主な操作

| 画面 | 操作 |
|------|------|
| タイトル | 「お題を決める」/ 人数±・名前入力 / 最下部「数字だけ確認する」/ 左上「お題リスト」「テーマ切替」/ 右上「履歴」「設定」 |
| お題を選ぶ | カードをタップで1つ選択 →「決定」で使用済み＆履歴へ |
| 数字確認 | 画面タップ →「あなたは〇〇さんですか？」→ はい → 数字表示 →「次の人へ」 |
| お題表示 | 10文字ごとに自動改行。左下「−／＋」で文字サイズ変更、右上「次のお題へ」、右下「数字忘れちゃった」、「⟳」で横画面レイアウト |
| お題リスト | ♡ / No. / お題（長い場合は自動横スクロール）/ 除外チェック、検索・♡リスト・除外リスト |
| 履歴 | 使用順に一覧（複数選択可）、右上「全削除」／ゴミ箱（選択分を確認なし削除）、「表示する」でお題表示へ |
| 設定 | 抽出数 1〜10 / 一人当たりの枚数 1〜5 / 数値範囲（最大4桁・左≦右）/ 使用済み除外（既定ON）/ お気に入り限定 / 除外の有効化 / お題の文字サイズ 50〜200% |

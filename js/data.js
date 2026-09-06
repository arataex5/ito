/* =========================================================
   data.js
   - CSV(./data/default_topics.csv) の取得と解析
   - fetch 失敗時（APK / file:// 実行時など）は埋め込みデータへ自動フォールバック
   - localStorage による永続化（お題 / 設定 / プレイヤー / 履歴）
   ========================================================= */
(function (global) {
  'use strict';

  var LS = {
    topics: 'ito.topics.v1',
    settings: 'ito.settings.v1',
    players: 'ito.players.v1',
    history: 'ito.history.v1',
    meta: 'ito.meta.v1'
  };

  /* ---------------------------------------------------------
     埋め込みフォールバックデータ
     （data/default_topics.csv と同一内容。fetch できない環境用）
     --------------------------------------------------------- */
  var EMBEDDED_CSV = [
    'No.,お題,評価,マスターデータ',
    '1,食べ物,1:低カロリーな食べ物-100:高カロリーな食べ物,1',
    '2,動物,1:小さい動物-100:大きい動物,1',
    '3,恋人にしたい有名人,1:興味がない-100:今すぐ結婚したい,1',
    '4,好きな季節,1:嫌いな季節-100:大好きな季節,1',
    '5,こわいもの,1:全然こわくない-100:めちゃくちゃこわい,1',
    '6,朝起きるのがつらい日,1:余裕で起きられる-100:絶対に起きられない,1',
    '7,人に貸したくないもの,1:いくらでも貸せる-100:絶対に貸したくない,1',
    '8,スマホの充電残量,1:全然平気な残量-100:焦る残量,1',
    '9,家事,1:好きな家事-100:嫌いな家事,1',
    '10,痛いこと,1:全然痛くない-100:想像を絶する痛さ,1',
    '11,におい,1:いいにおい-100:くさいにおい,1',
    '12,乗り物,1:遅い乗り物-100:速い乗り物,1',
    '13,飲み物,1:甘くない飲み物-100:とても甘い飲み物,1',
    '14,休日の予定,1:ひとりで過ごしたい-100:みんなで過ごしたい,1',
    '15,寿司ネタ,1:あまり好きじゃない-100:一番好き,1',
    '16,芸能人の知名度,1:全然知られていない-100:誰でも知っている,1',
    '17,人生でやり直したい出来事,1:別にどうでもいい-100:今すぐやり直したい,1',
    '18,コンビニで買うもの,1:めったに買わない-100:よく買う,1',
    '19,遅刻の言い訳,1:許される言い訳-100:絶対に許されない言い訳,1',
    '20,モテる特徴,1:モテない-100:めちゃくちゃモテる,1',
    '21,持ち物の重さ,1:とても軽い-100:とても重い,1',
    '22,子どもの頃の夢,1:現実的な夢-100:非現実的な夢,1',
    '23,アルバイト,1:楽なバイト-100:きついバイト,1',
    '24,虫,1:平気な虫-100:絶対に無理な虫,1',
    '25,SNSに投稿する内容,1:誰も反応しない-100:バズる,1',
    '26,寒さ,1:あたたかい場所-100:凍えるほど寒い場所,1',
    '27,好きなお菓子,1:あまり食べない-100:毎日でも食べたい,1',
    '28,人に言えない秘密,1:バレても平気-100:絶対にバレたくない,1',
    '29,ゲームの難易度,1:誰でもクリアできる-100:クリア不可能,1',
    '30,学校の教科,1:得意な教科-100:苦手な教科,1',
    '31,テンションが上がる瞬間,1:全く上がらない-100:最高に上がる,1',
    '32,調味料,1:少ししか使わない-100:たくさん使う,1',
    '33,長さ,1:とても短いもの-100:とても長いもの,1',
    '34,カラオケで歌う曲,1:誰も知らない曲-100:全員で歌える曲,1',
    '35,災害への備え,1:必要ない-100:絶対に必要,1',
    '36,アプリ,1:全く使わない-100:毎日使う,1',
    '37,旅行先,1:近くて手軽-100:遠くて大変,1',
    '38,かっこいい仕事,1:地味な仕事-100:めちゃくちゃかっこいい仕事,1',
    '39,眠くなる状況,1:目が冴える-100:一瞬で寝落ちする,1',
    '40,値段,1:安い買い物-100:高い買い物,1',
    '41,一人暮らしで必要なもの,1:なくても困らない-100:絶対に必要,1',
    '42,親に怒られたこと,1:軽く注意される-100:こっぴどく怒られる,1',
    '43,運動,1:楽な運動-100:きつい運動,1',
    '44,人気のペット,1:飼う人が少ない-100:飼う人が多い,1',
    '45,雨の日にしたいこと,1:したくない-100:とてもしたい,1',
    '46,漫画のジャンル,1:あまり読まない-100:一番読む,1',
    '47,飲み会のマナー,1:気にしなくていい-100:絶対に守るべき,1',
    '48,面倒な手続き,1:すぐ終わる-100:一日かかる,1',
    '49,好きな色,1:落ち着く色-100:派手な色,1',
    '50,昔流行ったもの,1:もう誰もやらない-100:今でも人気,1',
    '51,自慢できること,1:誰でもできる-100:世界に自慢できる,1',
    '52,眠る前のルーティン,1:やらない-100:必ずやる,1',
    '53,街で見かけたら二度見するもの,1:全く気にならない-100:絶対に二度見する,1',
    '54,好きなパンの種類,1:あまり選ばない-100:必ず選ぶ,1',
    '55,ストレス発散方法,1:効果がない-100:一発で解消する,1',
    '56,強いキャラクター,1:とても弱い-100:最強,1',
    '57,結婚相手に求める条件,1:なくてもいい-100:絶対に譲れない,1',
    '58,片付けが必要な場所,1:すぐ片付く-100:一生片付かない,1',
    '59,寿命が長い生き物,1:短命-100:とても長生き,1',
    '60,人生で大事なもの,1:なくてもいい-100:これがすべて,1'
  ].join('\n');

  /* ------------------------- CSV パーサ ------------------------- */
  function parseCSV(text) {
    var rows = [], row = [], field = '', inQuote = false, i, c, n;
    text = String(text).replace(/^﻿/, ''); // BOM除去
    for (i = 0; i < text.length; i++) {
      c = text[i]; n = text[i + 1];
      if (inQuote) {
        if (c === '"' && n === '"') { field += '"'; i++; }
        else if (c === '"') { inQuote = false; }
        else { field += c; }
      } else {
        if (c === '"') { inQuote = true; }
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else if (c === '\r') { /* skip */ }
        else { field += c; }
      }
    }
    if (field !== '' || row.length) { row.push(field); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (v) { return String(v).trim() !== ''; }); });
  }

  /* 「1:低カロリーな食べ物-100:高カロリーな食べ物」を分解 */
  function parseScale(raw) {
    var s = String(raw || '').trim();
    var m = s.match(/^\s*1\s*[:：]\s*([\s\S]*?)\s*[-ー－―]\s*100\s*[:：]\s*([\s\S]*)$/);
    if (m) return { low: m[1].trim(), high: m[2].trim() };
    var idx = s.indexOf('-100:');
    if (idx < 0) idx = s.indexOf('－100:');
    if (idx > -1) {
      return {
        low: s.slice(0, idx).replace(/^\s*1\s*[:：]\s*/, '').trim(),
        high: s.slice(idx + 5).replace(/^\s*[:：]\s*/, '').trim()
      };
    }
    return { low: '小さい', high: '大きい' };
  }

  function buildScale(low, high) { return '1:' + low + '-100:' + high; }

  function isTruthy(v) {
    var s = String(v == null ? '' : v).trim().toLowerCase();
    return s === '1' || s === 'true' || s === 'yes' || s === 'y' || s === '○';
  }

  /* CSV行 → お題オブジェクト配列 */
  function rowsToTopics(rows) {
    var out = [], start = 0;
    if (rows.length && /no/i.test(String(rows[0][0] || '')) === true) start = 1;
    else if (rows.length && isNaN(parseInt(rows[0][0], 10))) start = 1;
    for (var i = start; i < rows.length; i++) {
      var r = rows[i];
      var text = String(r[1] == null ? '' : r[1]).trim();
      if (!text) continue;
      var no = parseInt(r[0], 10);
      var sc = parseScale(r[2]);
      out.push({
        uid: 'm' + (isNaN(no) ? (i) : no),
        no: isNaN(no) ? (i) : no,
        text: text,
        low: sc.low,
        high: sc.high,
        master: isTruthy(r[3]),
        fav: false,
        ex: false,
        used: false
      });
    }
    return out;
  }

  /* ------------------------- localStorage ------------------------- */
  function lsGet(key, fallback) {
    try {
      var raw = global.localStorage.getItem(key);
      if (raw == null) return fallback;
      return JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function lsSet(key, value) {
    try { global.localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }

  var SETTINGS_VERSION = 2;
  var DEFAULT_SETTINGS = {
    pickCount: 5,          // お題の抽出数（1〜10）
    cardsPerPlayer: 1,     // 一人当たりの枚数（1〜5）
    numMin: 1,
    numMax: 100,
    excludeUsed: true,     // 使用したお題を除外する（デフォルトON）
    favoriteOnly: false,
    useExclusion: false,
    textScale: 100,        // お題表示の文字サイズ（50〜200%）
    theme: 'dark',         // 'dark' | 'light'
    __v: SETTINGS_VERSION
  };

  var APP_VERSION = '1.2.0';

  var Store = {
    version: APP_VERSION,
    topics: [],
    settings: Object.assign({}, DEFAULT_SETTINGS),
    players: { count: 4, names: ['', '', '', ''] },
    history: [],
    csvLoaded: false,
    csvSource: 'none',

    /* 初期化：CSV取得 → 失敗時は埋め込みデータ → localStorage とマージ */
    init: function () {
      var self = this;
      var savedSettings = lsGet(LS.settings, null) || {};
      if (savedSettings.__v !== SETTINGS_VERSION) {
        // 旧バージョンからの移行：新しい既定値を適用
        savedSettings.excludeUsed = true;
        savedSettings.__v = SETTINGS_VERSION;
      }
      self.settings = Object.assign({}, DEFAULT_SETTINGS, savedSettings);
      self.players = Object.assign({ count: 4, names: ['', '', '', ''] }, lsGet(LS.players, {}));
      self.history = lsGet(LS.history, []) || [];
      var saved = lsGet(LS.topics, null);

      return self._loadMaster().then(function (master) {
        self.topics = self._merge(master, saved);
        self.saveTopics();
        return self;
      });
    },

    _loadMaster: function () {
      var self = this;
      return new Promise(function (resolve) {
        var done = false;
        var fallback = function (reason) {
          if (done) return; done = true;
          self.csvSource = 'embedded(' + reason + ')';
          resolve(rowsToTopics(parseCSV(EMBEDDED_CSV)));
        };
        // file:// では fetch が使えないため即フォールバック
        if (global.location && global.location.protocol === 'file:') {
          fallback('file-protocol'); return;
        }
        var timer = setTimeout(function () { fallback('timeout'); }, 4000);
        try {
          fetch('./data/default_topics.csv', { cache: 'no-cache' })
            .then(function (res) {
              if (!res.ok) throw new Error('HTTP ' + res.status);
              return res.text();
            })
            .then(function (txt) {
              if (done) return;
              clearTimeout(timer);
              var list = rowsToTopics(parseCSV(txt));
              if (!list.length) throw new Error('empty csv');
              done = true;
              self.csvLoaded = true;
              self.csvSource = 'csv';
              resolve(list);
            })
            .catch(function (e) { clearTimeout(timer); fallback('fetch-error'); });
        } catch (e) { clearTimeout(timer); fallback('exception'); }
      });
    },

    /* マスター（CSV）とユーザーデータの統合 */
    _merge: function (master, saved) {
      if (!saved || !saved.length) return master.slice();
      var byUid = {};
      saved.forEach(function (t) { if (t && t.uid) byUid[t.uid] = t; });

      var merged = [];
      master.forEach(function (m) {
        var s = byUid[m.uid];
        if (s) {
          merged.push({
            uid: m.uid,
            no: (typeof s.no === 'number') ? s.no : m.no,
            text: m.text, low: m.low, high: m.high, master: true,
            fav: !!s.fav, ex: !!s.ex, used: !!s.used
          });
          delete byUid[m.uid];
        } else {
          merged.push(m);
        }
      });
      // ユーザー追加分（マスター以外）を後ろへ
      saved.forEach(function (s) {
        if (s && s.uid && byUid[s.uid] && !s.master) {
          merged.push({
            uid: s.uid, no: s.no, text: s.text, low: s.low, high: s.high,
            master: false, fav: !!s.fav, ex: !!s.ex, used: !!s.used
          });
        }
      });
      merged.sort(function (a, b) { return a.no - b.no; });
      return merged;
    },

    /* ------------------------- 保存 ------------------------- */
    saveTopics: function () { return lsSet(LS.topics, this.topics); },
    saveSettings: function () { return lsSet(LS.settings, this.settings); },
    savePlayers: function () { return lsSet(LS.players, this.players); },
    saveHistory: function () { return lsSet(LS.history, this.history); },

    /* ------------------------- お題操作 ------------------------- */
    byUid: function (uid) {
      for (var i = 0; i < this.topics.length; i++) if (this.topics[i].uid === uid) return this.topics[i];
      return null;
    },
    nextNo: function () {
      var max = 0;
      this.topics.forEach(function (t) { if (t.no > max) max = t.no; });
      return max + 1;
    },
    addTopic: function (text, low, high) {
      var t = {
        uid: 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
        no: this.nextNo(),
        text: String(text).trim(),
        low: String(low || '').trim() || '小さい',
        high: String(high || '').trim() || '大きい',
        master: false, fav: false, ex: false, used: false
      };
      this.topics.push(t);
      this.saveTopics();
      return t;
    },
    updateTopic: function (uid, text, low, high) {
      var t = this.byUid(uid);
      if (!t || t.master) return false;
      t.text = String(text).trim();
      t.low = String(low || '').trim() || '小さい';
      t.high = String(high || '').trim() || '大きい';
      this.saveTopics();
      return true;
    },
    deleteTopics: function (uids) {
      var set = {};
      uids.forEach(function (u) { set[u] = true; });
      this.topics = this.topics.filter(function (t) { return !(set[t.uid] && !t.master); });
      this.renumber();
      this.saveTopics();
    },
    /* No. の自動詰め */
    renumber: function () {
      this.topics.sort(function (a, b) { return a.no - b.no; });
      this.topics.forEach(function (t, i) { t.no = i + 1; });
    },
    toggleFav: function (uid) {
      var t = this.byUid(uid); if (!t) return;
      t.fav = !t.fav; this.saveTopics();
    },
    toggleEx: function (uid) {
      var t = this.byUid(uid); if (!t) return;
      t.ex = !t.ex; this.saveTopics();
    },

    /* 抽出母集団（設定を反映） */
    pool: function () {
      var s = this.settings;
      return this.topics.filter(function (t) {
        if (s.useExclusion && t.ex) return false;
        if (s.excludeUsed && t.used) return false;
        if (s.favoriteOnly && !t.fav) return false;
        return true;
      });
    },

    /* お題をランダム抽出 */
    draw: function (count) {
      var pool = this.pool();
      var relaxed = false;
      if (!pool.length) { pool = this.topics.slice(); relaxed = true; }
      var arr = pool.slice();
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return { list: arr.slice(0, Math.max(1, count)), relaxed: relaxed, poolSize: pool.length };
    },

    /* 使用済みにして履歴へ */
    markUsed: function (uid) {
      var t = this.byUid(uid);
      if (!t) return;
      t.used = true;
      this.saveTopics();
      this.history.push({
        uid: t.uid, no: t.no, text: t.text, low: t.low, high: t.high, ts: Date.now()
      });
      if (this.history.length > 500) this.history = this.history.slice(-500);
      this.saveHistory();
    },
    deleteHistory: function (ids) {
      var set = {};
      ids.forEach(function (i) { set[i] = true; });
      this.history = this.history.filter(function (h, i) { return !set[String(h.ts) + '_' + i]; });
      this.saveHistory();
    },
    clearHistory: function () {
      this.history = [];
      this.saveHistory();
    },
    resetUsed: function () {
      this.topics.forEach(function (t) { t.used = false; });
      this.saveTopics();
    },

    /* ------------------------- プレイヤー ------------------------- */
    playerNames: function () {
      var out = [], n = this.players.count;
      for (var i = 0; i < n; i++) {
        var nm = (this.players.names[i] || '').trim();
        out.push(nm || ('プレイヤー' + (i + 1)));
      }
      return out;
    },
    setPlayerCount: function (n) {
      n = Math.max(1, Math.min(20, n));
      this.players.count = n;
      while (this.players.names.length < n) this.players.names.push('');
      this.savePlayers();
    },
    setPlayerName: function (i, name) {
      this.players.names[i] = name;
      this.savePlayers();
    },

    /* ------------------------- 数字割り当て ------------------------- */
    /* 全プレイヤー分の数字を重複なしで割り当て、[[n,...], [n,...]] を返す */
    assignNumbers: function (playerCount, perPlayer) {
      var per = Math.max(1, Math.min(5, perPlayer || this.settings.cardsPerPlayer || 1));
      var min = this.settings.numMin, max = this.settings.numMax;
      if (max < min) { var sw = min; min = max; max = sw; }
      var range = max - min + 1;
      var total = playerCount * per;
      var flat = [];
      if (range >= total) {
        var used = {};
        while (flat.length < total) {
          var v = min + Math.floor(Math.random() * range);
          if (!used[v]) { used[v] = true; flat.push(v); }
        }
      } else {
        for (var i = 0; i < total; i++) flat.push(min + Math.floor(Math.random() * range));
      }
      var out = [];
      for (var p = 0; p < playerCount; p++) {
        var mine = flat.slice(p * per, (p + 1) * per);
        mine.sort(function (a, b) { return a - b; });
        out.push(mine);
      }
      return out;
    },

    /* 数字の範囲が足りているか */
    numbersFit: function (playerCount, perPlayer) {
      var per = Math.max(1, Math.min(5, perPlayer || this.settings.cardsPerPlayer || 1));
      var range = Math.abs(this.settings.numMax - this.settings.numMin) + 1;
      return range >= playerCount * per;
    },

    scaleString: buildScale,
    parseScale: parseScale,
    parseCSV: parseCSV
  };

  global.ItoStore = Store;
})(window);

/* =========================================================
   app.js  -  画面遷移・状態管理・ゲームロジック
   ========================================================= */
(function (global) {
  'use strict';

  var S = global.ItoStore;
  var $ = function (id) { return document.getElementById(id); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  /* ------------------------- 状態 ------------------------- */
  var nav = { current: null, stack: [] };
  var game = {
    players: [],          // [{name, number}]
    numIndex: 0,
    revealed: false,
    numAfter: 'numonly',  // 数字確認完了後の遷移先
    topic: null,
    candidates: [],
    pickSelected: null,
    displayMode: 'game',  // 'game' | 'view'
    displayBack: 'title',
    hasNumbers: false
  };
  var ui = {
    editMode: false,
    editingUid: null,
    listFilter: 'all',    // 'all' | 'fav' | 'ex'
    listQuery: '',
    listSelected: null,
    historySelected: []   // 履歴は複数選択
  };

  /* ------------------------- テーマ（ダーク / ライト） ------------------------- */
  function applyTheme() {
    var light = (S.settings.theme === 'light');
    document.body.classList.toggle('light', light);
    var btn = $('btn-theme');
    if (btn) btn.textContent = light ? '🌙 ダークモード' : '☀ ライトモード';
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', light ? '#f5f6fc' : '#0d0f1e');
  }
  function toggleTheme() {
    S.settings.theme = (S.settings.theme === 'light') ? 'dark' : 'light';
    S.saveSettings();
    applyTheme();
  }

  /* ------------------------- 汎用UI ------------------------- */
  function showToast(msg, ms) {
    var t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(t._tm);
    t._tm = setTimeout(function () { t.hidden = true; }, ms || 1800);
  }

  var modalCb = { yes: null, no: null };
  function confirmDialog(text, onYes, onNo) {
    $('modal-text').textContent = text;
    modalCb.yes = onYes || null;
    modalCb.no = onNo || null;
    $('modal').hidden = false;
  }
  function closeModal() { $('modal').hidden = true; modalCb.yes = modalCb.no = null; }

  /* 長いテキストの自動横スクロール（Marquee）適用 */
  function applyMarquee(root) {
    requestAnimationFrame(function () {
      $$('.mq', root || document).forEach(function (wrap) {
        var inner = wrap.querySelector('.mq-in');
        if (!inner) return;
        var dist = inner.scrollWidth - wrap.clientWidth;
        if (dist > 6) {
          wrap.style.setProperty('--mq-dist', dist + 'px');
          wrap.style.setProperty('--mq-dur', Math.max(3, Math.round(dist / 45) + 2) + 's');
          wrap.classList.add('run');
        } else {
          wrap.classList.remove('run');
        }
      });
    });
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* お題を10文字おきに改行して中央寄せ表示（1行が必ず収まるよう自動縮小） */
  function renderTopicText(elm, text) {
    var s = String(text || '');
    elm.innerHTML = '';
    var maxLen = 1;
    for (var i = 0; i < s.length; i += 10) {
      var line = s.slice(i, i + 10);
      if (line.length > maxLen) maxLen = line.length;
      var d = document.createElement('span');
      d.className = 'tline';
      d.textContent = line;
      elm.appendChild(d);
    }
    elm.dataset.text = s;
    fitTopicText(elm, maxLen);
  }
  function fitTopicText(elm, maxLen) {
    requestAnimationFrame(function () {
      var w = elm.clientWidth || (elm.parentElement && elm.parentElement.clientWidth) || 0;
      if (!w) return;
      // 10文字の行が横幅に収まるサイズを基準にする
      var size = Math.min(46, (w - 6) / (maxLen * 1.05));
      size = Math.max(14, Math.floor(size));
      elm.style.fontSize = size + 'px';
      // 縦にはみ出す場合は収まるまで縮小（横画面・小型端末・行数が多い場合）
      var guard = 0;
      while (elm.scrollHeight > elm.clientHeight + 1 && size > 14 && guard < 40) {
        size -= 1; guard++;
        elm.style.fontSize = size + 'px';
      }
      // ユーザー指定の拡大率（50〜200%）を反映
      var scale = Math.max(50, Math.min(200, S.settings.textScale || 100));
      elm.style.fontSize = Math.max(10, Math.round(size * scale / 100)) + 'px';
      // 拡大で縦にあふれる場合のみ上寄せ（横方向は行内で折り返すため常に中央）
      elm.style.justifyContent = (elm.scrollHeight > elm.clientHeight + 1) ? 'flex-start' : 'center';
    });
  }

  /* ------------------------- 画面遷移 ------------------------- */
  var onEnter = {};
  function show(name, opts) {
    opts = opts || {};
    if (nav.current && !opts.replace && nav.current !== name) nav.stack.push(nav.current);
    if (opts.resetStack) nav.stack = [];
    $$('.screen').forEach(function (s) { s.classList.remove('active'); });
    var el = $('screen-' + name);
    if (!el) return;
    el.classList.add('active');
    nav.current = name;
    var sc = el.querySelector('.scroll-area');
    if (sc && !opts.keepScroll) sc.scrollTop = 0;
    if (onEnter[name]) onEnter[name](opts);
  }
  function goBack() {
    var prev = nav.stack.pop() || 'title';
    $$('.screen').forEach(function (s) { s.classList.remove('active'); });
    $('screen-' + prev).classList.add('active');
    nav.current = prev;
    if (onEnter[prev]) onEnter[prev]({ back: true });
  }

  /* ------------------------- タイトル画面 ------------------------- */
  function renderPlayerInputs(containerId, countId) {
    var box = $(containerId);
    box.innerHTML = '';
    var n = S.players.count;
    $(countId).textContent = n;
    for (var i = 0; i < n; i++) {
      var row = document.createElement('div');
      row.className = 'pi-row';
      var idx = document.createElement('span');
      idx.className = 'pi-idx';
      idx.textContent = String(i + 1);
      var inp = document.createElement('input');
      inp.type = 'text';
      inp.maxLength = 12;
      inp.placeholder = 'プレイヤー' + (i + 1);
      inp.value = S.players.names[i] || '';
      inp.dataset.index = String(i);
      inp.addEventListener('input', function () {
        S.setPlayerName(parseInt(this.dataset.index, 10), this.value);
        syncPlayerInputs(this);
      });
      row.appendChild(idx); row.appendChild(inp);
      box.appendChild(row);
    }
  }
  function syncPlayerInputs(sourceInput) {
    // タイトル / プレイヤー画面の入力欄を相互同期
    var i = sourceInput.dataset.index;
    $$('.player-inputs input').forEach(function (inp) {
      if (inp !== sourceInput && inp.dataset.index === i) inp.value = sourceInput.value;
    });
  }
  function renderAllPlayerInputs() {
    renderPlayerInputs('player-inputs', 'pl-count');
    renderPlayerInputs('player-inputs-2', 'pl2-count');
  }

  onEnter.title = function () { renderAllPlayerInputs(); };

  /* ------------------------- 設定 ------------------------- */
  onEnter.settings = function () {
    $('set-pick-count').textContent = S.settings.pickCount;
    $('set-cards').textContent = S.settings.cardsPerPlayer;
    $('set-scale').textContent = S.settings.textScale + '%';
    $('set-num-min').value = S.settings.numMin;
    $('set-num-max').value = S.settings.numMax;
    $('set-exclude-used').checked = !!S.settings.excludeUsed;
    $('set-favorite-only').checked = !!S.settings.favoriteOnly;
    $('set-use-exclusion').checked = !!S.settings.useExclusion;
    updatePoolInfo();
    var v = $('version-info');
    if (v) v.textContent = 'ito app v' + (S.version || '-') + '　/　お題データ：' + (S.csvSource === 'csv' ? 'CSV読込' : '内蔵データ');
  };
  function updatePoolInfo() {
    var n = S.pool().length;
    var total = S.topics.length;
    var used = S.topics.filter(function (t) { return t.used; }).length;
    var fav = S.topics.filter(function (t) { return t.fav; }).length;
    $('pool-info').textContent =
      '抽出対象：' + n + ' 件 ／ 登録 ' + total + ' 件（使用済み ' + used + ' 件・お気に入り ' + fav + ' 件）';
  }
  function commitRange() {
    var mn = parseInt($('set-num-min').value, 10);
    var mx = parseInt($('set-num-max').value, 10);
    if (isNaN(mn)) mn = 1;
    if (isNaN(mx)) mx = 100;
    mn = Math.max(1, Math.min(9999, mn));
    mx = Math.max(1, Math.min(9999, mx));
    var bad = false;
    if (mn > mx) { bad = true; var t = mn; mn = mx; mx = t; }
    S.settings.numMin = mn; S.settings.numMax = mx;
    S.saveSettings();
    $('set-num-min').value = mn; $('set-num-max').value = mx;
    $('range-hint').textContent = bad
      ? '左 ≦ 右 になるよう自動で入れ替えました（最大4桁）'
      : '左 ≦ 右 / 最大4桁（9999）';
  }

  /* ------------------------- お題の追加・削除 ------------------------- */
  onEnter.editor = function (opts) {
    renderEditor();
    if (!opts || !opts.back) {
      requestAnimationFrame(function () {
        var sc = $('editor-scroll');
        sc.scrollTop = sc.scrollHeight;   // 初期表示はリスト最下部
      });
    }
  };
  function renderEditor() {
    var ul = $('editor-list');
    ul.innerHTML = '';
    S.topics.slice().sort(function (a, b) { return a.no - b.no; }).forEach(function (t) {
      var li = document.createElement('li');
      li.className = 'li' + (t.master ? ' master' : '');
      li.dataset.uid = t.uid;
      var checkHtml = '';
      if (ui.editMode) {
        checkHtml = t.master
          ? '<span class="li-badge">固定</span>'
          : '<label class="li-check"><input type="checkbox" class="ed-check"><span class="cbox"></span></label>';
      }
      li.innerHTML =
        '<span class="li-no">' + t.no + '</span>' +
        '<div class="li-main">' +
          '<div class="mq"><span class="mq-in">' + esc(t.text) + '</span></div>' +
          '<div class="li-sub">1:' + esc(t.low) + ' → 100:' + esc(t.high) + '</div>' +
        '</div>' + checkHtml;
      li.addEventListener('click', function (ev) {
        if (ui.editMode) {
          if (t.master) { showToast('マスターデータは削除できません'); return; }
          if (ev.target.closest('.li-check')) return; // ラベル操作はそのまま
          var cb = li.querySelector('.ed-check');
          cb.checked = !cb.checked;
          li.classList.toggle('sel', cb.checked);
        } else {
          if (t.master) { showToast('マスターデータは編集できません'); return; }
          openAddForm(t);
        }
      });
      var cbx = li.querySelector('.ed-check');
      if (cbx) cbx.addEventListener('change', function () { li.classList.toggle('sel', cbx.checked); });
      ul.appendChild(li);
    });
    applyMarquee(ul);
    $('btn-edit-mode').textContent = ui.editMode ? '完了' : '編集';
    $('btn-edit-mode').classList.toggle('on', ui.editMode);
    $('editor-delete-bar').hidden = !ui.editMode;
    $('btn-add-open').hidden = ui.editMode;
  }
  function openAddForm(topic) {
    ui.editingUid = topic ? topic.uid : null;
    $('af-title').textContent = topic ? 'お題を編集（No.' + topic.no + '）' : 'お題を追加（No.' + S.nextNo() + '）';
    $('af-topic').value = topic ? topic.text : '';
    $('af-low').value = topic ? topic.low : '';
    $('af-high').value = topic ? topic.high : '';
    $('add-form').hidden = false;
    $('btn-add-open').hidden = true;
    requestAnimationFrame(function () {
      $('add-form').scrollIntoView({ block: 'center' });
      $('af-topic').focus();
    });
  }
  function closeAddForm() {
    $('add-form').hidden = true;
    $('btn-add-open').hidden = ui.editMode;
    ui.editingUid = null;
  }

  /* ------------------------- お題リスト ------------------------- */
  onEnter.list = function () { ui.listSelected = null; renderList(); };
  function renderList() {
    var ul = $('topic-list');
    var q = ui.listQuery.trim().toLowerCase();
    ul.innerHTML = '';
    var items = S.topics.slice().sort(function (a, b) { return a.no - b.no; }).filter(function (t) {
      if (ui.listFilter === 'fav' && !t.fav) return false;
      if (ui.listFilter === 'ex' && !t.ex) return false;
      if (q) {
        var hay = (t.text + ' ' + t.low + ' ' + t.high + ' ' + t.no).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    if (!items.length) {
      ul.innerHTML = '<li class="empty-note">該当するお題がありません</li>';
      $('btn-list-show').disabled = true;
      return;
    }
    items.forEach(function (t) {
      var li = document.createElement('li');
      li.className = 'li' + (ui.listSelected === t.uid ? ' sel' : '');
      li.dataset.uid = t.uid;
      li.innerHTML =
        '<button class="li-heart' + (t.fav ? ' on' : '') + '" aria-label="お気に入り">' + (t.fav ? '♥' : '♡') + '</button>' +
        '<span class="li-no">' + t.no + '</span>' +
        '<div class="li-main">' +
          '<div class="mq"><span class="mq-in">' + esc(t.text) + '</span></div>' +
          '<div class="li-sub">1:' + esc(t.low) + ' → 100:' + esc(t.high) + '</div>' +
        '</div>' +
        '<label class="li-check"><input type="checkbox" class="ex-check"' + (t.ex ? ' checked' : '') + '><span class="cbox"></span></label>';
      li.querySelector('.li-heart').addEventListener('click', function (ev) {
        ev.stopPropagation();
        S.toggleFav(t.uid);
        renderList();
      });
      li.querySelector('.ex-check').addEventListener('change', function (ev) {
        ev.stopPropagation();
        S.toggleEx(t.uid);
      });
      li.querySelector('.li-check').addEventListener('click', function (ev) { ev.stopPropagation(); });
      li.addEventListener('click', function () {
        ui.listSelected = (ui.listSelected === t.uid) ? null : t.uid;
        $$('#topic-list .li').forEach(function (x) { x.classList.remove('sel'); });
        if (ui.listSelected) li.classList.add('sel');
        $('btn-list-show').disabled = !ui.listSelected;
      });
      ul.appendChild(li);
    });
    applyMarquee(ul);
    $('btn-list-show').disabled = !ui.listSelected;
    $('btn-filter-fav').classList.toggle('on', ui.listFilter === 'fav');
    $('btn-filter-ex').classList.toggle('on', ui.listFilter === 'ex');
  }

  /* ------------------------- 履歴 ------------------------- */
  onEnter.history = function () { ui.historySelected = []; renderHistory(); };
  function renderHistory() {
    var ul = $('history-list');
    ul.innerHTML = '';
    if (!S.history.length) {
      ul.innerHTML = '<li class="empty-note">まだ使用したお題はありません</li>';
      updateHistoryButtons();
      return;
    }
    S.history.slice().reverse().forEach(function (h, ri) {
      var i = S.history.length - 1 - ri;
      var id = String(h.ts) + '_' + i;
      var d = new Date(h.ts);
      var tm = (d.getMonth() + 1) + '/' + d.getDate() + ' ' +
        ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
      var li = document.createElement('li');
      li.className = 'li' + (ui.historySelected.indexOf(id) > -1 ? ' sel' : '');
      li.dataset.hid = id;
      li.innerHTML =
        '<span class="li-pick"></span>' +
        '<span class="li-no">' + (i + 1) + '</span>' +
        '<div class="li-main">' +
          '<div class="mq"><span class="mq-in">' + esc(h.text) + '</span></div>' +
          '<div class="li-sub">' + tm + '　1:' + esc(h.low) + ' → 100:' + esc(h.high) + '</div>' +
        '</div>';
      li.addEventListener('click', function () {
        var k = ui.historySelected.indexOf(id);
        if (k > -1) ui.historySelected.splice(k, 1);
        else ui.historySelected.push(id);
        li.classList.toggle('sel', ui.historySelected.indexOf(id) > -1);
        updateHistoryButtons();
      });
      ul.appendChild(li);
    });
    applyMarquee(ul);
    updateHistoryButtons();
  }
  function updateHistoryButtons() {
    var n = ui.historySelected.length;
    var btn = $('btn-history-show');
    btn.disabled = (n !== 1);
    btn.textContent = (n > 1) ? '表示する（1件だけ選択）' : '表示する';
    $('btn-history-clear').disabled = !S.history.length;
  }
  function historyEntry(id) {
    for (var i = 0; i < S.history.length; i++) {
      if (String(S.history[i].ts) + '_' + i === id) return S.history[i];
    }
    return null;
  }

  /* ------------------------- お題を決める（抽出） ------------------------- */
  function drawTopics() {
    var res = S.draw(S.settings.pickCount);
    game.candidates = res.list;
    game.pickSelected = null;
    if (res.relaxed) showToast('条件に合うお題がないため全お題から抽出しました', 2600);
    else if (res.poolSize < S.settings.pickCount) showToast('抽出対象が ' + res.poolSize + ' 件しかありません', 2200);
  }
  onEnter.pick = function () { renderPick(); };
  function renderPick() {
    var box = $('pick-cards');
    box.innerHTML = '';
    game.candidates.forEach(function (t) {
      var b = document.createElement('button');
      b.className = 'pcard' + (game.pickSelected === t.uid ? ' sel' : '');
      b.type = 'button';
      b.innerHTML =
        '<div class="pcard-top"><span class="pcard-no">No.' + t.no + '</span>' +
        (t.fav ? '<span class="li-heart on" style="width:auto;height:auto;font-size:14px">♥</span>' : '') +
        (t.used ? '<span class="li-badge used">使用済み</span>' : '') + '</div>' +
        '<div class="pcard-title">' + esc(t.text) + '</div>' +
        '<div class="pcard-scale">1：' + esc(t.low) + '　／　100：' + esc(t.high) + '</div>';
      b.addEventListener('click', function () {
        game.pickSelected = t.uid;
        $$('.pcard', box).forEach(function (x) { x.classList.remove('sel'); });
        b.classList.add('sel');
        $('btn-pick-decide').disabled = false;
      });
      box.appendChild(b);
    });
    $('btn-pick-decide').disabled = !game.pickSelected;
  }

  /* ------------------------- 数字確認（共通） ------------------------- */
  function startNumberCheck(after, opts) {
    opts = opts || {};
    var names = S.playerNames();
    var per = S.settings.cardsPerPlayer || 1;
    var nums = S.assignNumbers(names.length, per);
    game.players = names.map(function (n, i) { return { name: n, numbers: nums[i] }; });
    game.numIndex = 0;
    game.revealed = false;
    game.numAfter = after;
    game.hasNumbers = true;
    if (!S.numbersFit(names.length, per)) {
      showToast('数字の範囲が狭いため（必要 ' + (names.length * per) + ' 個）重複する場合があります', 2800);
    }
    show('number', opts);
  }
  onEnter.number = function () { renderNumber(); };
  function renderNumbers(elm, arr) {
    var n = Math.max(1, Math.min(5, arr.length));
    elm.className = 'big-number cnt-' + n;
    elm.innerHTML = arr.map(function (v) { return '<span class="nchip">' + v + '</span>'; }).join('');
  }
  function renderNumber() {
    var p = game.players[game.numIndex];
    if (!p) return;
    $('num-progress').textContent = (game.numIndex + 1) + ' / ' + game.players.length;
    $('num-msg').textContent = p.name + 'さんの番です。表示された数字を忘れないようにしてください。';
    $('num-name').textContent = p.name + 'さんの数字' + (p.numbers.length > 1 ? '（' + p.numbers.length + '枚）' : '');
    renderNumbers($('big-number'), p.numbers);
    $('num-stage').hidden = game.revealed;
    $('num-reveal').hidden = !game.revealed;
    var last = (game.numIndex === game.players.length - 1);
    var btn = $('btn-num-next');
    btn.textContent = last
      ? (game.numAfter === 'display' ? 'お題を表示する' : '次の画面へ')
      : '次の人へ';
    btn.disabled = !game.revealed;
  }
  function numberTapped() {
    if (game.revealed) return;
    var p = game.players[game.numIndex];
    confirmDialog('あなたは' + p.name + 'さんですか？', function () {
      game.revealed = true;
      renderNumber();
    });
  }
  function numberNext() {
    if (!game.revealed) return;
    if (game.numIndex < game.players.length - 1) {
      game.numIndex++;
      game.revealed = false;
      renderNumber();
    } else {
      if (game.numAfter === 'display') {
        game.displayMode = 'game';
        game.displayBack = 'title';
        show('display', { resetStack: true });
      } else if (game.numAfter === 'backToDisplay') {
        game.displayMode = 'view';
        show('display', { replace: true });
      } else {
        show('numonly', { resetStack: true });
      }
    }
  }

  /* ------------------------- お題表示 ------------------------- */
  onEnter.display = function () { syncZoomLabel(); renderDisplay(); };
  function renderDisplay() {
    var t = game.topic;
    if (!t) return;
    $('disp-no').textContent = 'No.' + (t.no || '-');
    renderTopicText($('disp-text'), t.text);
    $('disp-low').textContent = t.low;
    $('disp-high').textContent = t.high;
    var isGame = (game.displayMode === 'game');
    $('disp-left').textContent = isGame ? '‹ タイトル' : '‹ 戻る';
    $('disp-next').hidden = !isGame;
    $('disp-forgot').hidden = !game.hasNumbers;
    $('disp-checknum').hidden = game.hasNumbers;
  }

  function changeScale(delta) {
    var v = Math.max(50, Math.min(200, (S.settings.textScale || 100) + delta));
    if (v === S.settings.textScale) { showToast(delta > 0 ? 'これ以上大きくできません' : 'これ以上小さくできません', 1200); return; }
    S.settings.textScale = v;
    S.saveSettings();
    syncZoomLabel();
    refitDisplay();
  }
  function syncZoomLabel() {
    var v = S.settings.textScale || 100;
    var z = $('disp-zoom-val'); if (z) z.textContent = v + '%';
    var t = $('set-scale'); if (t) t.textContent = v + '%';
  }

  function refitDisplay() {
    var t = $('disp-text');
    if (t && t.dataset.text) renderTopicText(t, t.dataset.text);
  }

  /* ------------------------- 数字忘れちゃった ------------------------- */
  onEnter.forgot = function () { renderForgot(); };
  function renderForgot() {
    var ul = $('forgot-list');
    ul.innerHTML = '';
    $('forgot-reveal').hidden = true;
    if (!game.players.length) {
      ul.innerHTML = '<li class="empty-note">数字がまだ割り当てられていません</li>';
      return;
    }
    game.players.forEach(function (p) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.className = 'name-item';
      b.type = 'button';
      b.innerHTML = '<span class="pi-idx">' + (game.players.indexOf(p) + 1) + '</span><span>' + esc(p.name) + '</span>';
      b.addEventListener('click', function () {
        confirmDialog('あなたは' + p.name + 'さんですか？', function () {
          $('forgot-name').textContent = p.name + 'さんの数字' + (p.numbers.length > 1 ? '（' + p.numbers.length + '枚）' : '');
          renderNumbers($('forgot-number'), p.numbers);
          $('forgot-reveal').hidden = false;
        });
      });
      li.appendChild(b);
      ul.appendChild(li);
    });
  }

  /* ------------------------- イベント登録 ------------------------- */
  function bind() {
    // 共通ナビゲーション
    document.addEventListener('click', function (ev) {
      var go = ev.target.closest('[data-go]');
      if (go) { show(go.dataset.go); return; }
      var back = ev.target.closest('[data-back]');
      if (back) { goBack(); return; }
      var orient = ev.target.closest('.btn-orient');
      if (orient) {
        document.body.classList.toggle('rotated');
        setTimeout(refitDisplay, 60);
        showToast(document.body.classList.contains('rotated') ? '横画面レイアウト' : '縦画面レイアウト', 1200);
        applyMarquee();
        return;
      }
    });

    // モーダル
    $('modal-yes').addEventListener('click', function () {
      var cb = modalCb.yes; closeModal(); if (cb) cb();
    });
    $('modal-no').addEventListener('click', function () {
      var cb = modalCb.no; closeModal(); if (cb) cb();
    });
    $('modal').addEventListener('click', function (ev) {
      if (ev.target === $('modal')) { var cb = modalCb.no; closeModal(); if (cb) cb(); }
    });

    // タイトル：人数増減
    $('pl-plus').addEventListener('click', function () { S.setPlayerCount(S.players.count + 1); renderAllPlayerInputs(); });
    $('pl-minus').addEventListener('click', function () { S.setPlayerCount(S.players.count - 1); renderAllPlayerInputs(); });
    $('pl2-plus').addEventListener('click', function () { S.setPlayerCount(S.players.count + 1); renderAllPlayerInputs(); });
    $('pl2-minus').addEventListener('click', function () { S.setPlayerCount(S.players.count - 1); renderAllPlayerInputs(); });

    // タイトル：お題を決める / 数字だけ確認する
    $('btn-pick-topic').addEventListener('click', function () {
      drawTopics();
      show('pick');
    });
    $('btn-number-only').addEventListener('click', function () {
      game.topic = null;
      startNumberCheck('numonly');
    });

    // タイトル：ダーク / ライト切替
    $('btn-theme').addEventListener('click', toggleTheme);

    // タイトル：アプリ（APK）のインストール
    $('btn-install-open').addEventListener('click', openInstallSheet);
    $('install-close').addEventListener('click', closeInstallSheet);
    $('install-sheet').addEventListener('click', function (ev) {
      if (ev.target === this) closeInstallSheet();
    });
    $('install-dl').addEventListener('click', function () {
      showToast('ダウンロードを開始しました。通知欄から ito.apk を開いてインストールしてください。', 4200);
      setTimeout(closeInstallSheet, 600);
    });

    // お題表示：文字サイズの拡大・縮小
    $('disp-zoom-in').addEventListener('click', function () { changeScale(10); });
    $('disp-zoom-out').addEventListener('click', function () { changeScale(-10); });

    // 設定
    $$('[data-step]').forEach(function (b) {
      b.addEventListener('click', function () {
        var parts = b.dataset.step.split(':');
        var key = parts[0], delta = parseInt(parts[1], 10);
        if (key === 'pickCount') {
          S.settings.pickCount = Math.max(1, Math.min(10, S.settings.pickCount + delta));
          $('set-pick-count').textContent = S.settings.pickCount;
        } else if (key === 'cardsPerPlayer') {
          S.settings.cardsPerPlayer = Math.max(1, Math.min(5, S.settings.cardsPerPlayer + delta));
          $('set-cards').textContent = S.settings.cardsPerPlayer;
        } else if (key === 'textScale') {
          S.settings.textScale = Math.max(50, Math.min(200, (S.settings.textScale || 100) + delta));
          $('set-scale').textContent = S.settings.textScale + '%';
          syncZoomLabel();
        }
        S.saveSettings();
        updatePoolInfo();
      });
    });
    ['set-num-min', 'set-num-max'].forEach(function (id) {
      $(id).addEventListener('change', commitRange);
      $(id).addEventListener('blur', commitRange);
    });
    $('set-exclude-used').addEventListener('change', function () {
      S.settings.excludeUsed = this.checked; S.saveSettings(); updatePoolInfo();
    });
    $('set-favorite-only').addEventListener('change', function () {
      S.settings.favoriteOnly = this.checked; S.saveSettings(); updatePoolInfo();
    });
    $('set-use-exclusion').addEventListener('change', function () {
      S.settings.useExclusion = this.checked; S.saveSettings(); updatePoolInfo();
    });

    // お題の追加・削除
    $('btn-edit-mode').addEventListener('click', function () {
      ui.editMode = !ui.editMode;
      closeAddForm();
      renderEditor();
    });
    $('btn-add-open').addEventListener('click', function () { openAddForm(null); });
    $('af-cancel').addEventListener('click', function (ev) { ev.preventDefault(); closeAddForm(); });
    $('add-form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var text = $('af-topic').value.trim();
      var low = $('af-low').value.trim();
      var high = $('af-high').value.trim();
      if (!text) { showToast('お題を入力してください'); return; }
      if (ui.editingUid) {
        S.updateTopic(ui.editingUid, text, low, high);
        showToast('お題を更新しました');
      } else {
        var t = S.addTopic(text, low, high);
        showToast('No.' + t.no + ' として追加しました');
      }
      closeAddForm();
      renderEditor();
    });
    $('btn-delete-selected').addEventListener('click', function () {
      var uids = $$('#editor-list .ed-check:checked').map(function (cb) {
        return cb.closest('.li').dataset.uid;
      });
      if (!uids.length) { showToast('削除するお題を選択してください'); return; }
      confirmDialog(uids.length + ' 件のお題を削除します。よろしいですか？', function () {
        S.deleteTopics(uids);
        renderEditor();
        showToast('削除しました（No.を詰めました）');
      });
    });

    // お題リスト
    $('btn-filter-fav').addEventListener('click', function () {
      ui.listFilter = (ui.listFilter === 'fav') ? 'all' : 'fav';
      ui.listSelected = null; renderList();
    });
    $('btn-filter-ex').addEventListener('click', function () {
      ui.listFilter = (ui.listFilter === 'ex') ? 'all' : 'ex';
      ui.listSelected = null; renderList();
    });
    $('list-search').addEventListener('input', function () {
      ui.listQuery = this.value; ui.listSelected = null; renderList();
    });
    $('btn-list-show').addEventListener('click', function () {
      var t = S.byUid(ui.listSelected);
      if (!t) return;
      game.topic = { no: t.no, text: t.text, low: t.low, high: t.high, uid: t.uid };
      game.displayMode = 'view';
      game.displayBack = 'list';
      game.hasNumbers = false;
      game.players = [];
      show('display');
    });

    // 履歴
    $('btn-history-show').addEventListener('click', function () {
      if (ui.historySelected.length !== 1) return;
      var h = historyEntry(ui.historySelected[0]);
      if (!h) return;
      game.topic = { no: h.no, text: h.text, low: h.low, high: h.high, uid: h.uid };
      game.displayMode = 'view';
      game.displayBack = 'history';
      game.hasNumbers = false;
      game.players = [];
      show('display');
    });
    $('btn-history-trash').addEventListener('click', function () {
      if (!ui.historySelected.length) { showToast('削除するお題を選択してください'); return; }
      var n = ui.historySelected.length;
      S.deleteHistory(ui.historySelected);     // ポップアップなしで削除
      ui.historySelected = [];
      renderHistory();
      showToast(n + ' 件を履歴から削除しました');
    });
    $('btn-history-clear').addEventListener('click', function () {
      if (!S.history.length) { showToast('履歴はありません'); return; }
      confirmDialog('履歴をすべて削除します。よろしいですか？', function () {
        S.clearHistory();
        ui.historySelected = [];
        renderHistory();
        showToast('履歴をすべて削除しました');
      });
    });

    // お題を決める
    $('btn-repick').addEventListener('click', function () { drawTopics(); renderPick(); });
    $('btn-pick-decide').addEventListener('click', function () {
      var t = S.byUid(game.pickSelected);
      if (!t) return;
      S.markUsed(t.uid);
      game.topic = { no: t.no, text: t.text, low: t.low, high: t.high, uid: t.uid };
      startNumberCheck('display');
    });

    // 数字確認
    $('number-tap').addEventListener('click', numberTapped);
    $('btn-num-next').addEventListener('click', numberNext);

    // お題表示
    $('disp-left').addEventListener('click', function () {
      if (game.displayMode === 'game') show('title', { resetStack: true });
      else show(game.displayBack || 'list', { resetStack: true });
    });
    $('disp-next').addEventListener('click', function () {
      drawTopics();
      show('pick', { resetStack: true });
    });
    $('disp-forgot').addEventListener('click', function () { show('forgot'); });
    $('disp-checknum').addEventListener('click', function () { show('players'); });

    // プレイヤー入力（お題リスト経由）
    $('btn-players-go').addEventListener('click', function () {
      startNumberCheck('backToDisplay', { replace: false });
    });

    // 数字だけ確認・完了画面
    $('btn-renew-numbers').addEventListener('click', function () {
      confirmDialog('数字を割り当て直しますか？', function () {
        startNumberCheck(game.numAfter === 'display' ? 'display' : 'numonly', { resetStack: true });
      });
    });
    $('btn-forgot-main').addEventListener('click', function () { show('forgot'); });

    // 数字忘れちゃった：数字表示のオーバーレイを閉じる
    $('forgot-reveal').addEventListener('click', function () { this.hidden = true; });

    // 画面回転・リサイズ時に Marquee 再計算
    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt); rt = setTimeout(function () { applyMarquee(); refitDisplay(); }, 200);
    });
    window.addEventListener('orientationchange', function () {
      setTimeout(function () { applyMarquee(); refitDisplay(); }, 300);
    });

    // Android の「戻る」ボタン（Capacitor / APK）に対応
    try {
      var CapApp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
      if (CapApp && CapApp.addListener) {
        CapApp.addListener('backButton', function () {
          if (!$('modal').hidden) { closeModal(); return; }
          if (!$('forgot-reveal').hidden) { $('forgot-reveal').hidden = true; return; }
          if (nav.current && nav.current !== 'title') { goBack(); return; }
          if (CapApp.exitApp) CapApp.exitApp();
        });
      }
    } catch (e) { /* Web では何もしない */ }

    // iOS のピンチ/ダブルタップズーム抑止
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (e) {
      document.addEventListener(e, function (ev) { ev.preventDefault(); }, { passive: false });
    });
    var lastTouch = 0;
    document.addEventListener('touchend', function (ev) {
      var now = Date.now();
      if (now - lastTouch <= 300) ev.preventDefault();
      lastTouch = now;
    }, { passive: false });
  }

  /* ------------------------- アプリ（APK）のインストール導線 ------------------------- */
  function initInstallButton() {
    var btn = $('btn-install-open');
    if (!btn) return;
    var ua = navigator.userAgent || '';
    var isNative = !!(global.Capacitor && (global.Capacitor.isNativePlatform
      ? global.Capacitor.isNativePlatform() : global.Capacitor.isNative));
    var isIOS = /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    // アプリ版で開いているとき / iOS では表示しない（APKはAndroid専用のため）
    if (isNative || isIOS) { btn.hidden = true; return; }
    btn.hidden = false;
  }
  function openInstallSheet() { $('install-sheet').hidden = false; }
  function closeInstallSheet() { $('install-sheet').hidden = true; }

  /* ------------------------- 起動 ------------------------- */
  function boot() {
    // 保存済みテーマを初期化前に反映（ちらつき防止）
    try {
      var raw = window.localStorage.getItem('ito.settings.v1');
      if (raw && JSON.parse(raw).theme === 'light') document.body.classList.add('light');
    } catch (e) {}
    bind();
    S.init().then(function () {
      applyTheme();
      syncZoomLabel();
      initInstallButton();
      renderAllPlayerInputs();
      show('title', { resetStack: true });
    }).catch(function (e) {
      // 何があってもタイトルは表示する
      applyTheme();
      show('title', { resetStack: true });
      showToast('データの初期化に失敗しました');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  global.ItoApp = { show: show, state: game };
})(window);

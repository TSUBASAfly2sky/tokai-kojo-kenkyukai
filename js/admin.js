/* ========================================
   東海古城研究会 - 管理画面ロジック v3
   ======================================== */

(function() {
  'use strict';

  const PASS_KEY    = 'tkk_admin_pass_v1';
  const SESSION_KEY = 'tkk_admin_session_v1';
  const DEFAULT_PASS = 'tokai1960';

  /* ---- Cloudflare Worker 設定 ----
   * Cloudflare Worker を作成したら、WORKER_URL にその URL を貼り付ける。
   * WORKER_SECRET は Cloudflare の環境変数に設定した値と同じ文字列にする。
   */
  const WORKER_URL    = 'https://tokai-kojo.hugtsubasa.workers.dev';
  const WORKER_SECRET = 'tkk-secret-2024-kojo';

  /* ============================================
     簡易ハッシュ（SHA-256）
     ============================================ */
  async function hashPass(pass) {
    const encoder = new TextEncoder();
    const data = encoder.encode(pass);
    const hashBuf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  async function getStoredPassHash() {
    let stored = localStorage.getItem(PASS_KEY);
    if (!stored) {
      stored = await hashPass(DEFAULT_PASS);
      localStorage.setItem(PASS_KEY, stored);
    }
    return stored;
  }

  /* ============================================
     メッセージ表示
     ============================================ */
  let _msgTimer = null;
  function showMsg(text, type) {
    const box = document.getElementById('adminMsg');
    if (!box) return;
    if (_msgTimer) { clearTimeout(_msgTimer); _msgTimer = null; }
    box.innerHTML = `<div class="admin-${type}">${TKK.escapeHtml(text)}</div>`;
    _msgTimer = setTimeout(() => { box.innerHTML = ''; _msgTimer = null; }, 5000);
  }

  function showLoginError(text) {
    const box = document.getElementById('loginError');
    box.textContent = text;
    box.classList.remove('hidden');
  }

  /* ============================================
     ログイン処理
     ============================================ */
  async function tryLogin() {
    const pass = document.getElementById('loginPass').value;
    if (!pass) { showLoginError('パスワードを入力してください'); return; }
    const hash = await hashPass(pass);
    const stored = await getStoredPassHash();
    if (hash === stored) {
      sessionStorage.setItem(SESSION_KEY, '1');
      showAdmin();
    } else {
      showLoginError('パスワードが違います');
    }
  }

  function showAdmin() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('adminScreen').classList.remove('hidden');
    initAdmin();
  }

  function logout() {
    sessionStorage.removeItem(SESSION_KEY);
    location.reload();
  }

  /* ============================================
     Cloudflare Worker 経由で GitHub に反映
     ============================================ */

  /* UTF-8文字列をBase64エンコード（日本語対応） */
  function toBase64(str) {
    const bytes = new TextEncoder().encode(str);
    const binary = Array.from(bytes).map(b => String.fromCharCode(b)).join('');
    return btoa(binary);
  }

  /**
   * Worker にファイルを1件プッシュする内部関数
   */
  async function pushFile(fileName, content) {
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: WORKER_SECRET,
        file: fileName,
        content: toBase64(JSON.stringify(content, null, 2)),
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || res.status);
    }
  }

  /**
   * data.json（本文のみ）と data-images.json（写真のみ）に分けて GitHub に push する
   */
  async function pushToGitHub() {
    if (!WORKER_URL) {
      showMsg('⚠️ Worker URLが未設定です。管理者に連絡してください。', 'error');
      return;
    }

    try {
      // ① 本文データ（写真なし）
      const metaData = {
        news: data.news,
        reports: data.reports.map(({ images, ...meta }) => meta),
      };

      // ② 既存の data-images.json をサイトから取得して「ベース」にする
      //    （管理画面のメモリに写真がなくても既存の写真を消さないため）
      let imagesData = {};
      try {
        const imgRes = await fetch(
          'https://tokai-kojo-kenkyukai.jp/data-images.json',
          { cache: 'no-store' }
        );
        if (imgRes.ok) imagesData = await imgRes.json();
      } catch(e) {}

      // ③ 今回変更・追加された記事の写真で上書き
      data.reports.forEach(r => {
        if (Array.isArray(r.images)) {
          if (r.images.length > 0) {
            imagesData[r.id] = r.images;      // 追加・更新
          } else if (r.id in imagesData) {
            delete imagesData[r.id];           // 写真を全削除した場合
          }
        }
        // r.images が undefined（読み込んでいない）→ 既存の写真を維持
      });

      // 両ファイルを並行してプッシュ
      await Promise.all([
        pushFile('data.json', metaData),
        pushFile('data-images.json', imagesData),
      ]);

      showMsg('✅ サイトに反映しました。数分後に表示が更新されます。', 'success');
    } catch (e) {
      showMsg('❌ 反映に失敗しました: ' + e.message, 'error');
    }
  }

  /* ============================================
     データ読み書き
     ============================================ */
  let data = { news: [], reports: [] };

  // 写真枚数キャッシュ { reportId: 枚数 }（一覧表示用）
  let imagesCounts = {};

  // 編集中の活動報告の写真（Base64データURLの配列）
  let reportImages = [];

  // 画像圧縮設定
  const IMG_MAX_DIM = 1200;  // 長辺の最大ピクセル
  const IMG_QUALITY = 0.75;  // JPEG品質（0〜1）

  /**
   * 画像ファイルをリサイズ＆JPEG圧縮してBase64データURLにする
   */
  function compressImage(file) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('画像ファイルではありません'));
        return;
      }
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          let w = img.width;
          let h = img.height;
          if (w >= h && w > IMG_MAX_DIM) {
            h = Math.round(h * IMG_MAX_DIM / w);
            w = IMG_MAX_DIM;
          } else if (h > w && h > IMG_MAX_DIM) {
            w = Math.round(w * IMG_MAX_DIM / h);
            h = IMG_MAX_DIM;
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', IMG_QUALITY));
        };
        img.onerror = () => reject(new Error('画像を読み込めませんでした'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('ファイルを読み込めませんでした'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * 複数ファイルを順に圧縮して reportImages に追加
   */
  async function addImageFiles(fileList) {
    const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) {
      showMsg('画像ファイルを選んでください', 'error');
      return;
    }
    const status = document.getElementById('reportImageStatus');
    let added = 0;
    for (let i = 0; i < files.length; i++) {
      if (status) status.textContent = `画像を処理中... (${i + 1}/${files.length})`;
      try {
        const dataUrl = await compressImage(files[i]);
        reportImages.push(dataUrl);
        added++;
      } catch (err) {
        console.warn('画像処理スキップ:', err.message);
      }
    }
    if (status) status.textContent = '';
    renderImagePreview();
    if (added > 0) showMsg(`写真を${added}枚追加しました`, 'success');
  }

  /**
   * 写真プレビュー描画（削除ボタン付き）
   */
  function renderImagePreview() {
    const box = document.getElementById('reportImagePreview');
    if (!box) return;
    if (reportImages.length === 0) { box.innerHTML = ''; return; }
    box.innerHTML = reportImages.map((src, i) => `
      <div class="img-preview-cell">
        <img src="${src}" alt="写真${i + 1}">
        <button type="button" class="img-remove" data-idx="${i}" title="削除">×</button>
        <span class="img-order">${i + 1}</span>
      </div>
    `).join('');
  }

  // 管理画面は常に公開サイトから最新データを取得する
  const LIVE_DATA_URL = 'https://tokai-kojo-kenkyukai.jp/data.json';

  async function refreshData() {
    TKK.clearCache();
    localStorage.removeItem(TKK.STORAGE_KEY);

    try {
      const res = await fetch(LIVE_DATA_URL, { cache: 'no-store' });
      if (res.ok) {
        data = await res.json();
      }
    } catch(e) {
      // オフライン時はローカルの data.json にフォールバック
      try {
        const res2 = await fetch('data.json', { cache: 'no-store' });
        if (res2.ok) data = await res2.json();
      } catch(e2) {}
    }

    data.news    = data.news    || [];
    data.reports = data.reports || [];

    // バックグラウンドで写真枚数だけ取得（一覧表示用）
    fetch('https://tokai-kojo-kenkyukai.jp/data-images.json', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : {})
      .then(imagesData => {
        imagesCounts = {};
        Object.keys(imagesData).forEach(id => {
          imagesCounts[id] = (imagesData[id] || []).length;
        });
        renderReportAdmin(); // 枚数を反映して再描画
      })
      .catch(() => {});

    return data;
  }

  function persist() {
    TKK.saveData(data);
  }

  /* ============================================
     お知らせ
     ============================================ */
  function clearNewsForm() {
    document.getElementById('newsId').value = '';
    document.getElementById('newsTitle').value = '';
    document.getElementById('newsDate').value = todayString();
    document.getElementById('newsContent').value = '';
    document.getElementById('newsPublished').checked = true;
    updatePublishedLabel('news');
    document.getElementById('newsFormTitle').textContent = '📢 お知らせを追加';
  }

  function fillNewsForm(item) {
    document.getElementById('newsId').value = item.id;
    document.getElementById('newsTitle').value = item.title || '';
    document.getElementById('newsDate').value = item.date || '';
    document.getElementById('newsContent').value = item.content || '';
    document.getElementById('newsPublished').checked = TKK.isPublished(item);
    updatePublishedLabel('news');
    document.getElementById('newsFormTitle').textContent = '📢 お知らせを編集';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveNews() {
    const id = document.getElementById('newsId').value;
    const title      = document.getElementById('newsTitle').value.trim();
    const date       = document.getElementById('newsDate').value;
    const content    = document.getElementById('newsContent').value.trim();
    const is_published = document.getElementById('newsPublished').checked;

    if (!title)   { showMsg('タイトルを入力してください', 'error'); return; }
    if (!date)    { showMsg('日付を入力してください', 'error'); return; }
    if (!content) { showMsg('内容を入力してください', 'error'); return; }

    if (id) {
      const idx = data.news.findIndex(n => n.id === id);
      if (idx >= 0) data.news[idx] = { id, title, date, content, is_published };
    } else {
      data.news.push({ id: TKK.genId('news'), title, date, content, is_published });
    }
    persist();
    showMsg(id ? 'お知らせを更新しました' : 'お知らせを追加しました', 'success');
    clearNewsForm();
    renderNewsAdmin();
    await pushToGitHub();
  }

  async function deleteNews(id) {
    if (!confirm('このお知らせを削除します。よろしいですか？')) return;
    data.news = data.news.filter(n => n.id !== id);
    persist();
    renderNewsAdmin();
    showMsg('お知らせを削除しました', 'success');
    await pushToGitHub();
  }

  async function toggleNewsPublished(id) {
    const item = data.news.find(n => n.id === id);
    if (!item) return;
    item.is_published = !TKK.isPublished(item);
    delete item.published;
    persist();
    renderNewsAdmin();
    await pushToGitHub();
  }

  function renderNewsAdmin() {
    const el = document.getElementById('newsAdminList');
    const sorted = TKK.sortByDateDesc(data.news);
    if (sorted.length === 0) {
      el.innerHTML = '<div class="empty-state">まだ登録がありません</div>';
      return;
    }
    el.innerHTML = sorted.map(item => {
      const pub = TKK.isPublished(item);
      return `
      <div class="item-row">
        <div class="item-row-info">
          <h4>${TKK.escapeHtml(item.title)}
            <span class="badge ${pub ? 'public' : 'private'}">${pub ? '公開中' : '非公開'}</span>
          </h4>
          <div class="item-row-meta">${TKK.formatDate(item.date)}</div>
        </div>
        <div class="item-row-actions">
          <button class="btn btn-secondary btn-sm" data-act="toggle-news" data-id="${item.id}">${pub ? '非公開にする' : '公開する'}</button>
          <button class="btn btn-secondary btn-sm" data-act="edit-news" data-id="${item.id}">編集</button>
          <button class="btn btn-danger btn-sm" data-act="del-news" data-id="${item.id}">削除</button>
        </div>
      </div>
      `;
    }).join('');
  }

  /* ============================================
     活動報告
     ============================================ */
  function clearReportForm() {
    document.getElementById('reportId').value = '';
    document.getElementById('reportTitle').value = '';
    document.getElementById('reportDate').value = todayString();
    document.getElementById('reportLocation').value = '';
    document.getElementById('reportContent').value = '';
    document.getElementById('reportPublished').checked = true;
    reportImages = [];
    renderImagePreview();
    updatePublishedLabel('report');
    document.getElementById('reportFormTitle').textContent = '🏯 活動報告を追加';
  }

  async function fillReportForm(item) {
    document.getElementById('reportId').value = item.id;
    document.getElementById('reportTitle').value = item.title || '';
    document.getElementById('reportDate').value = item.date || '';
    document.getElementById('reportLocation').value = item.location || '';
    document.getElementById('reportContent').value = item.content || '';
    document.getElementById('reportPublished').checked = TKK.isPublished(item);
    updatePublishedLabel('report');
    document.getElementById('reportFormTitle').textContent = '🏯 活動報告を編集';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 写真を読み込む間は保存ボタンを無効化（早押しによる写真消滅を防ぐ）
    const saveBtn = document.getElementById('reportSaveBtn');
    if (saveBtn) saveBtn.disabled = true;

    reportImages = [];
    renderImagePreview();
    const status = document.getElementById('reportImageStatus');
    if (status) status.textContent = '写真を読み込み中...';
    try {
      if (item.images && item.images.length > 0) {
        // 旧フォーマット（data.json に images が含まれている場合）
        reportImages = item.images.slice();
      } else {
        // 新フォーマット（ライブサイトの data-images.json から取得）
        const res = await fetch(
          'https://tokai-kojo-kenkyukai.jp/data-images.json',
          { cache: 'no-store' }
        );
        if (res.ok) {
          const imagesData = await res.json();
          reportImages = imagesData[item.id] || [];
        }
      }
    } catch(e) {
      reportImages = [];
    }
    if (status) status.textContent = '';
    renderImagePreview();

    // 読み込み完了後に保存ボタンを再度有効化
    if (saveBtn) saveBtn.disabled = false;
  }

  async function saveReport() {
    const id       = document.getElementById('reportId').value;
    const title    = document.getElementById('reportTitle').value.trim();
    const date     = document.getElementById('reportDate').value;
    const location = document.getElementById('reportLocation').value.trim();
    const content  = document.getElementById('reportContent').value.trim();
    const images   = reportImages.slice();
    const is_published = document.getElementById('reportPublished').checked;

    if (!title)   { showMsg('タイトルを入力してください', 'error'); return; }
    if (!date)    { showMsg('日付を入力してください', 'error'); return; }
    if (!content) { showMsg('内容を入力してください', 'error'); return; }

    const backup = JSON.stringify(data.reports);

    if (id) {
      const idx = data.reports.findIndex(r => r.id === id);
      if (idx >= 0) data.reports[idx] = { id, title, date, location, content, images, is_published };
    } else {
      data.reports.push({ id: TKK.genId('report'), title, date, location, content, images, is_published });
    }

    try {
      persist();
    } catch (err) {
      data.reports = JSON.parse(backup);
      showMsg('写真が多すぎてブラウザに保存できませんでした。写真の枚数を減らしてから保存してください。', 'error');
      return;
    }

    showMsg(id ? '活動報告を更新しました' : '活動報告を追加しました', 'success');
    clearReportForm();
    renderReportAdmin();
    await pushToGitHub();
  }

  async function deleteReport(id) {
    if (!confirm('この活動報告を削除します。よろしいですか？')) return;
    data.reports = data.reports.filter(r => r.id !== id);
    persist();
    renderReportAdmin();
    showMsg('活動報告を削除しました', 'success');
    await pushToGitHub();
  }

  async function toggleReportPublished(id) {
    const item = data.reports.find(r => r.id === id);
    if (!item) return;
    item.is_published = !TKK.isPublished(item);
    delete item.published;
    persist();
    renderReportAdmin();
    await pushToGitHub();
  }

  function renderReportAdmin() {
    const el = document.getElementById('reportAdminList');
    const sorted = TKK.sortByDateDesc(data.reports);
    if (sorted.length === 0) {
      el.innerHTML = '<div class="empty-state">まだ登録がありません</div>';
      return;
    }
    el.innerHTML = sorted.map(item => {
      const pub = TKK.isPublished(item);
      return `
      <div class="item-row">
        <div class="item-row-info">
          <h4>${TKK.escapeHtml(item.title)}
            <span class="badge ${pub ? 'public' : 'private'}">${pub ? '公開中' : '非公開'}</span>
          </h4>
          <div class="item-row-meta">${TKK.formatDate(item.date)}${item.location ? ' / ' + TKK.escapeHtml(item.location) : ''}${imagesCounts[item.id] > 0 ? ' / 📷' + imagesCounts[item.id] + '枚' : ''}</div>
        </div>
        <div class="item-row-actions">
          <button class="btn btn-secondary btn-sm" data-act="toggle-report" data-id="${item.id}">${pub ? '非公開にする' : '公開する'}</button>
          <button class="btn btn-secondary btn-sm" data-act="edit-report" data-id="${item.id}">編集</button>
          <button class="btn btn-danger btn-sm" data-act="del-report" data-id="${item.id}">削除</button>
        </div>
      </div>
      `;
    }).join('');
  }

  /* ============================================
     ユーティリティ
     ============================================ */
  function todayString() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  function updatePublishedLabel(prefix) {
    const cb  = document.getElementById(prefix + 'Published');
    const lbl = document.getElementById(prefix + 'PublishedLabel');
    if (lbl) lbl.textContent = cb.checked ? '公開する' : '非公開';
  }

  function switchTab(panelName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelector(`.tab[data-panel="${panelName}"]`).classList.add('active');
    document.getElementById('panel-' + panelName).classList.add('active');
  }

  /* ============================================
     初期化
     ============================================ */
  async function initAdmin() {
    try {
      await refreshData();
    } catch(e) {
      console.error('データ読み込みエラー:', e);
      data = { news: [], reports: [] };
    }
    clearNewsForm();
    clearReportForm();
    renderNewsAdmin();
    renderReportAdmin();

    /* ---- タブ ---- */
    document.querySelectorAll('.tab').forEach(t => {
      t.addEventListener('click', () => switchTab(t.dataset.panel));
    });

    /* ---- お知らせ ---- */
    document.getElementById('newsSaveBtn').addEventListener('click', saveNews);
    document.getElementById('newsCancelBtn').addEventListener('click', clearNewsForm);
    document.getElementById('newsPublished').addEventListener('change', () => updatePublishedLabel('news'));

    /* ---- 活動報告 ---- */
    document.getElementById('reportSaveBtn').addEventListener('click', saveReport);
    document.getElementById('reportCancelBtn').addEventListener('click', clearReportForm);
    document.getElementById('reportPublished').addEventListener('change', () => updatePublishedLabel('report'));

    /* ---- 写真ドラッグ＆ドロップ ---- */
    const dropzone = document.getElementById('reportDropzone');
    const picker   = document.getElementById('reportImagePicker');

    dropzone.addEventListener('click', (e) => {
      if (e.target === picker) return;
      picker.click();
    });
    dropzone.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); picker.click(); }
    });
    picker.addEventListener('change', e => {
      if (e.target.files && e.target.files.length) addImageFiles(e.target.files);
      e.target.value = '';
    });
    ['dragenter', 'dragover'].forEach(ev => {
      dropzone.addEventListener(ev, e => {
        e.preventDefault(); e.stopPropagation();
        dropzone.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(ev => {
      dropzone.addEventListener(ev, e => {
        e.preventDefault(); e.stopPropagation();
        if (ev === 'dragleave' && dropzone.contains(e.relatedTarget)) return;
        dropzone.classList.remove('dragover');
      });
    });
    dropzone.addEventListener('drop', e => {
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length) addImageFiles(files);
    });

    /* ---- 写真削除ボタン ---- */
    document.getElementById('reportImagePreview').addEventListener('click', e => {
      const btn = e.target.closest('.img-remove');
      if (!btn) return;
      const idx = parseInt(btn.dataset.idx, 10);
      reportImages.splice(idx, 1);
      renderImagePreview();
    });

    /* ---- 一覧ボタン（お知らせ） ---- */
    document.getElementById('newsAdminList').addEventListener('click', e => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.dataset.act === 'edit-news')   fillNewsForm(data.news.find(n => n.id === id));
      if (btn.dataset.act === 'del-news')    deleteNews(id);
      if (btn.dataset.act === 'toggle-news') toggleNewsPublished(id);
    });

    /* ---- 一覧ボタン（活動報告） ---- */
    document.getElementById('reportAdminList').addEventListener('click', e => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.dataset.act === 'edit-report')   fillReportForm(data.reports.find(r => r.id === id));
      if (btn.dataset.act === 'del-report')    deleteReport(id);
      if (btn.dataset.act === 'toggle-report') toggleReportPublished(id);
    });

    /* ---- ログアウト ---- */
    document.getElementById('logoutBtn').addEventListener('click', logout);
  }

  /* ============================================
     ページロード時
     ============================================ */
  document.addEventListener('DOMContentLoaded', function() {
    if (sessionStorage.getItem(SESSION_KEY) === '1') {
      showAdmin();
    }
    document.getElementById('loginBtn').addEventListener('click', tryLogin);
    document.getElementById('loginPass').addEventListener('keydown', e => {
      if (e.key === 'Enter') tryLogin();
    });
  });
})();

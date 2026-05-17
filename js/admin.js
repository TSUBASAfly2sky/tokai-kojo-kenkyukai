/* ========================================
   東海古城研究会 - 管理画面ロジック v2
   ======================================== */

(function() {
  'use strict';

  const PASS_KEY = 'tkk_admin_pass_v1';
  const SESSION_KEY = 'tkk_admin_session_v1';
  const DEFAULT_PASS = 'tokai1960';

  /* ---- 簡易ハッシュ（SHA-256） ---- */
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

  /* ---- メッセージ表示 ---- */
  function showMsg(text, type) {
    const box = document.getElementById('adminMsg');
    if (!box) return;
    box.innerHTML = `<div class="admin-${type}">${TKK.escapeHtml(text)}</div>`;
    setTimeout(() => { box.innerHTML = ''; }, 4000);
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
     データ読み書き
     ============================================ */
  let data = { news: [], reports: [] };

  async function refreshData() {
    data = await TKK.loadData();
    data.news = data.news || [];
    data.reports = data.reports || [];
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

  function saveNews() {
    const id = document.getElementById('newsId').value;
    const title = document.getElementById('newsTitle').value.trim();
    const date = document.getElementById('newsDate').value;
    const content = document.getElementById('newsContent').value.trim();
    const is_published = document.getElementById('newsPublished').checked;

    if (!title) { showMsg('タイトルを入力してください', 'error'); return; }
    if (!date)  { showMsg('日付を入力してください', 'error'); return; }
    if (!content) { showMsg('内容を入力してください', 'error'); return; }

    if (id) {
      const idx = data.news.findIndex(n => n.id === id);
      if (idx >= 0) {
        data.news[idx] = { id, title, date, content, is_published };
        showMsg('お知らせを更新しました', 'success');
      }
    } else {
      data.news.push({ id: TKK.genId('news'), title, date, content, is_published });
      showMsg('お知らせを追加しました', 'success');
    }
    persist();
    clearNewsForm();
    renderNewsAdmin();
  }

  function deleteNews(id) {
    if (!confirm('このお知らせを削除します。よろしいですか？')) return;
    data.news = data.news.filter(n => n.id !== id);
    persist();
    renderNewsAdmin();
    showMsg('お知らせを削除しました', 'success');
  }

  function toggleNewsPublished(id) {
    const item = data.news.find(n => n.id === id);
    if (!item) return;
    item.is_published = !TKK.isPublished(item);
    delete item.published;  // 旧フィールドは削除
    persist();
    renderNewsAdmin();
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
    updatePublishedLabel('report');
    document.getElementById('reportFormTitle').textContent = '🏯 活動報告を追加';
  }

  function fillReportForm(item) {
    document.getElementById('reportId').value = item.id;
    document.getElementById('reportTitle').value = item.title || '';
    document.getElementById('reportDate').value = item.date || '';
    document.getElementById('reportLocation').value = item.location || '';
    document.getElementById('reportContent').value = item.content || '';
    document.getElementById('reportPublished').checked = TKK.isPublished(item);
    updatePublishedLabel('report');
    document.getElementById('reportFormTitle').textContent = '🏯 活動報告を編集';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function saveReport() {
    const id = document.getElementById('reportId').value;
    const title = document.getElementById('reportTitle').value.trim();
    const date = document.getElementById('reportDate').value;
    const location = document.getElementById('reportLocation').value.trim();
    const content = document.getElementById('reportContent').value.trim();
    const is_published = document.getElementById('reportPublished').checked;

    if (!title) { showMsg('タイトルを入力してください', 'error'); return; }
    if (!date)  { showMsg('日付を入力してください', 'error'); return; }
    if (!content) { showMsg('内容を入力してください', 'error'); return; }

    if (id) {
      const idx = data.reports.findIndex(r => r.id === id);
      if (idx >= 0) {
        data.reports[idx] = { id, title, date, location, content, is_published };
        showMsg('活動報告を更新しました', 'success');
      }
    } else {
      data.reports.push({ id: TKK.genId('report'), title, date, location, content, is_published });
      showMsg('活動報告を追加しました', 'success');
    }
    persist();
    clearReportForm();
    renderReportAdmin();
  }

  function deleteReport(id) {
    if (!confirm('この活動報告を削除します。よろしいですか？')) return;
    data.reports = data.reports.filter(r => r.id !== id);
    persist();
    renderReportAdmin();
    showMsg('活動報告を削除しました', 'success');
  }

  function toggleReportPublished(id) {
    const item = data.reports.find(r => r.id === id);
    if (!item) return;
    item.is_published = !TKK.isPublished(item);
    delete item.published;
    persist();
    renderReportAdmin();
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
          <div class="item-row-meta">${TKK.formatDate(item.date)}${item.location ? ' / ' + TKK.escapeHtml(item.location) : ''}</div>
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
     JSON エクスポート / インポート
     ============================================ */
  function exportJSON() {
    const exportData = {
      news: data.news,
      reports: data.reports,
      exportedAt: new Date().toISOString()
    };
    const text = JSON.stringify(exportData, null, 2);
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showMsg('data.json を書き出しました。GitHubのリポジトリに上書きしてください。', 'success');
  }

  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!parsed.news || !parsed.reports) {
          showMsg('JSONの形式が違います（news / reports が必要）', 'error');
          return;
        }
        if (!confirm('現在のデータを置き換えます。よろしいですか？')) return;
        data = {
          news: parsed.news || [],
          reports: parsed.reports || []
        };
        persist();
        renderNewsAdmin();
        renderReportAdmin();
        showMsg('JSONを読み込みました', 'success');
      } catch (err) {
        showMsg('JSON読み込みエラー:' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  }

  /* ============================================
     パスワード変更
     ============================================ */
  async function changePassword() {
    const current = document.getElementById('currentPass').value;
    const next = document.getElementById('newPass').value;
    const confirmPass = document.getElementById('newPassConfirm').value;

    if (!current || !next || !confirmPass) {
      showMsg('すべて入力してください', 'error'); return;
    }
    if (next.length < 6) {
      showMsg('新しいパスワードは6文字以上にしてください', 'error'); return;
    }
    if (next !== confirmPass) {
      showMsg('新しいパスワードが一致しません', 'error'); return;
    }
    const stored = await getStoredPassHash();
    const currentHash = await hashPass(current);
    if (currentHash !== stored) {
      showMsg('現在のパスワードが違います', 'error'); return;
    }
    const newHash = await hashPass(next);
    localStorage.setItem(PASS_KEY, newHash);
    document.getElementById('currentPass').value = '';
    document.getElementById('newPass').value = '';
    document.getElementById('newPassConfirm').value = '';
    showMsg('パスワードを変更しました', 'success');
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
    const cb = document.getElementById(prefix + 'Published');
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
    await refreshData();
    clearNewsForm();
    clearReportForm();
    renderNewsAdmin();
    renderReportAdmin();

    document.querySelectorAll('.tab').forEach(t => {
      t.addEventListener('click', () => switchTab(t.dataset.panel));
    });

    document.getElementById('newsSaveBtn').addEventListener('click', saveNews);
    document.getElementById('newsCancelBtn').addEventListener('click', clearNewsForm);
    document.getElementById('reportSaveBtn').addEventListener('click', saveReport);
    document.getElementById('reportCancelBtn').addEventListener('click', clearReportForm);
    document.getElementById('newsPublished').addEventListener('change', () => updatePublishedLabel('news'));
    document.getElementById('reportPublished').addEventListener('change', () => updatePublishedLabel('report'));

    document.getElementById('newsAdminList').addEventListener('click', e => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.dataset.act === 'edit-news') fillNewsForm(data.news.find(n => n.id === id));
      if (btn.dataset.act === 'del-news') deleteNews(id);
      if (btn.dataset.act === 'toggle-news') toggleNewsPublished(id);
    });
    document.getElementById('reportAdminList').addEventListener('click', e => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const id = btn.dataset.id;
      if (btn.dataset.act === 'edit-report') fillReportForm(data.reports.find(r => r.id === id));
      if (btn.dataset.act === 'del-report') deleteReport(id);
      if (btn.dataset.act === 'toggle-report') toggleReportPublished(id);
    });

    document.getElementById('exportBtn').addEventListener('click', exportJSON);
    document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
    document.getElementById('importFile').addEventListener('change', e => {
      const file = e.target.files[0];
      if (file) importJSON(file);
      e.target.value = '';
    });

    document.getElementById('changePassBtn').addEventListener('click', changePassword);
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

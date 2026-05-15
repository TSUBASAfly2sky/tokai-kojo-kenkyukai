/* ========================================
   東海古城研究会 - 共通データロジック
   ======================================== */

const TKK = (function() {
  'use strict';

  const STORAGE_KEY = 'tkk_site_data_v1';
  let cachedData = null;

  /**
   * データを取得する。優先順位:
   *   1. localStorage（管理画面で編集後の状態）
   *   2. data.json（GitHubに置かれた本番データ）
   *   3. 空のデータ
   */
  async function loadData() {
    if (cachedData) return cachedData;

    // 1. localStorage を確認
    const local = localStorage.getItem(STORAGE_KEY);
    if (local) {
      try {
        cachedData = JSON.parse(local);
        return cachedData;
      } catch (e) {
        console.warn('localStorage のデータが壊れているため無視します', e);
      }
    }

    // 2. data.json を読む
    try {
      const res = await fetch('data.json', { cache: 'no-store' });
      if (res.ok) {
        cachedData = await res.json();
        return cachedData;
      }
    } catch (e) {
      console.warn('data.json の読み込みに失敗しました', e);
    }

    // 3. 空データ
    cachedData = { news: [], reports: [] };
    return cachedData;
  }

  /**
   * 日付フォーマット（YYYY-MM-DD → YYYY.MM.DD）
   */
  function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}.${m}.${day}`;
  }

  /**
   * HTMLエスケープ
   */
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * 日付の降順でソート（新しいものが上）
   */
  function sortByDateDesc(items) {
    return [...items].sort((a, b) => {
      const da = new Date(a.date).getTime() || 0;
      const db = new Date(b.date).getTime() || 0;
      return db - da;
    });
  }

  /**
   * お知らせを描画
   */
  async function renderNews(elementId, limit) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const data = await loadData();
    const items = sortByDateDesc(data.news.filter(n => n.published !== false));
    const list = limit ? items.slice(0, limit) : items;

    if (list.length === 0) {
      el.innerHTML = '<div class="empty-state">現在お知らせはありません。</div>';
      return;
    }

    el.innerHTML = list.map(item => `
      <article class="news-item">
        <div class="news-date">${formatDate(item.date)}</div>
        <div class="news-body">
          <h3>${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.content)}</p>
        </div>
      </article>
    `).join('');
  }

  /**
   * 最近の活動報告（カード）を描画
   */
  async function renderRecentReports(elementId, limit) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const data = await loadData();
    const items = sortByDateDesc(data.reports.filter(r => r.published !== false));
    const list = limit ? items.slice(0, limit) : items;

    if (list.length === 0) {
      el.innerHTML = '<div class="empty-state">まだ活動報告がありません。</div>';
      return;
    }

    el.innerHTML = list.map(item => `
      <article class="report-card">
        <div class="report-card-meta">
          <span class="report-card-date">${formatDate(item.date)}</span>
          ${item.location ? `<span class="report-card-location">${escapeHtml(item.location)}</span>` : ''}
        </div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.content)}</p>
      </article>
    `).join('');
  }

  /**
   * 報告ページ用：年絞り込み付き全件描画
   */
  async function renderReports(elementId, yearFilter) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const data = await loadData();
    let items = sortByDateDesc(data.reports.filter(r => r.published !== false));

    if (yearFilter && yearFilter !== 'all') {
      items = items.filter(r => {
        const y = new Date(r.date).getFullYear();
        return String(y) === String(yearFilter);
      });
    }

    if (items.length === 0) {
      el.innerHTML = '<div class="empty-state">該当する活動報告がありません。</div>';
      return;
    }

    el.innerHTML = items.map(item => `
      <article class="report-detail-item">
        <div class="report-card-meta">
          <span class="report-card-date">${formatDate(item.date)}</span>
          ${item.location ? `<span class="report-card-location">${escapeHtml(item.location)}</span>` : ''}
        </div>
        <h3>${escapeHtml(item.title)}</h3>
        <div class="body">${escapeHtml(item.content)}</div>
      </article>
    `).join('');
  }

  /**
   * 管理画面用：localStorageへ保存
   */
  function saveData(data) {
    cachedData = data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  /**
   * キャッシュを無効化（強制リロード用）
   */
  function clearCache() {
    cachedData = null;
  }

  // ID生成
  function genId(prefix) {
    return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  }

  // 公開 API
  return {
    loadData: loadData,
    saveData: saveData,
    clearCache: clearCache,
    renderNews: renderNews,
    renderRecentReports: renderRecentReports,
    renderReports: renderReports,
    formatDate: formatDate,
    escapeHtml: escapeHtml,
    genId: genId,
    STORAGE_KEY: STORAGE_KEY
  };
})();

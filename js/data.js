/* ========================================
   東海古城研究会 - 共通データロジック v2
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

    cachedData = { news: [], reports: [] };
    return cachedData;
  }

  /**
   * 管理画面用：localStorageへ保存
   */
  function saveData(data) {
    cachedData = data;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  /**
   * キャッシュ無効化
   */
  function clearCache() {
    cachedData = null;
  }

  /**
   * 公開フラグの判定（is_published と published の両対応）
   */
  function isPublished(item) {
    if (!item) return false;
    if (item.is_published === false) return false;
    if (item.published === false) return false;
    return true;
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
   * 日本語日付フォーマット（YYYY年MM月DD日）
   */
  function formatDateJP(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
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
   * 日付の降順でソート
   */
  function sortByDateDesc(items) {
    return [...items].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  /**
   * ID生成
   */
  function genId(prefix) {
    return prefix + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  }

  /**
   * クエリパラメータ取得
   */
  function getQueryParam(key) {
    const params = new URLSearchParams(window.location.search);
    return params.get(key);
  }

  return {
    loadData: loadData,
    saveData: saveData,
    clearCache: clearCache,
    isPublished: isPublished,
    formatDate: formatDate,
    formatDateJP: formatDateJP,
    escapeHtml: escapeHtml,
    sortByDateDesc: sortByDateDesc,
    genId: genId,
    getQueryParam: getQueryParam,
    STORAGE_KEY: STORAGE_KEY
  };
})();

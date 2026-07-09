/**
 * 東海古城研究会 - Cloudflare Worker v2
 *
 * 【環境変数】
 *   GH_PAT         : GitHubのPersonal Access Token
 *   WORKER_SECRET  : 管理画面との合言葉（admin.js の WORKER_SECRET と同じ）
 */

const GH_OWNER   = 'TSUBASAfly2sky';
const GH_REPO    = 'tokai-kojo-kenkyukai';
const GH_BRANCH  = 'main';
const ALLOWED_FILES = ['data.json', 'data-images.json'];

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    /* ============================================
       アクセスカウンター（GET /count）
       KVネームスペース COUNTER に保存
       ?mode=hit  … カウントを+1して返す（初回訪問者用）
       ?mode=peek … カウントせず現在値だけ返す
       ============================================ */
    if (request.method === 'GET' && url.pathname === '/count') {
      if (!env.COUNTER) {
        return json({ error: 'COUNTER KVが未設定です' }, 500, corsHeaders);
      }
      const mode = url.searchParams.get('mode') || 'hit';
      let count = parseInt(await env.COUNTER.get('total')) || 0;
      if (mode === 'hit') {
        count += 1;
        await env.COUNTER.put('total', String(count));
      }
      return json({ count }, 200, corsHeaders);
    }

    /* ============================================
       GitHubから最新データを直接読む（GET /read?file=data.json）
       GitHub Pages/CDNの反映遅延・キャッシュの影響を受けず、
       プッシュ直後の最新内容を返す（管理画面用）。
       ============================================ */
    if (request.method === 'GET' && url.pathname === '/read') {
      const file = url.searchParams.get('file') || 'data.json';
      if (!ALLOWED_FILES.includes(file)) {
        return json({ error: '不正なファイル名です' }, 400, corsHeaders);
      }
      const apiUrl = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${file}?ref=${GH_BRANCH}`;
      const ghRes = await fetch(apiUrl, {
        headers: {
          'Authorization': `token ${env.GH_PAT}`,
          'Accept': 'application/vnd.github.raw',
          'User-Agent': 'tokai-kojo-worker',
        },
      });
      if (!ghRes.ok) {
        if (ghRes.status === 404) return json({}, 200, corsHeaders); // 未作成→空
        return json({ error: 'GitHub読み取り失敗: ' + ghRes.status }, 500, corsHeaders);
      }
      const text = await ghRes.text();
      return new Response(text, {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: 'リクエストが不正です' }, 400, corsHeaders);
    }

    // 合言葉の確認
    if (!body.secret || body.secret !== env.WORKER_SECRET) {
      return json({ error: '認証エラー' }, 401, corsHeaders);
    }

    if (!body.content) {
      return json({ error: 'content がありません' }, 400, corsHeaders);
    }

    // 対象ファイルの確認（data.json または data-images.json のみ許可）
    const file = body.file || 'data.json';
    if (!ALLOWED_FILES.includes(file)) {
      return json({ error: '不正なファイル名です' }, 400, corsHeaders);
    }

    const ghBase = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${file}`;
    const ghHeaders = {
      'Authorization': `token ${env.GH_PAT}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'tokai-kojo-worker',
      'Content-Type': 'application/json',
    };

    // 現在の SHA を取得（ファイルが存在しない場合は新規作成）
    let sha = null;
    const shaRes = await fetch(`${ghBase}?ref=${GH_BRANCH}`, { headers: ghHeaders });
    if (shaRes.ok) {
      const fileData = await shaRes.json();
      sha = fileData.sha;
    } else if (shaRes.status !== 404) {
      const err = await shaRes.json().catch(() => ({}));
      return json({ error: 'SHA取得失敗: ' + (err.message || shaRes.status) }, 500, corsHeaders);
    }

    // ファイルを更新（または新規作成）
    const putBody = {
      message: `${file} 更新（管理画面）`,
      content: body.content,
      branch: GH_BRANCH,
    };
    if (sha) putBody.sha = sha;

    const putRes = await fetch(ghBase, {
      method: 'PUT',
      headers: ghHeaders,
      body: JSON.stringify(putBody),
    });

    const result = await putRes.json().catch(() => ({}));
    return json(result, putRes.status, corsHeaders);
  },
};

function json(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

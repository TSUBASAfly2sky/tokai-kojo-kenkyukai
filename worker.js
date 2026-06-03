/**
 * 東海古城研究会 - Cloudflare Worker
 *
 * 【役割】
 * 管理画面からのリクエストを受け取り、GitHub API を呼んで data.json を更新する。
 * GitHub トークンはここに環境変数として安全に保管されるため、
 * 管理画面を使う各デバイスにトークンを設定する必要がなくなる。
 *
 * 【Cloudflare Workers の環境変数に設定するもの】
 *   GH_PAT          : GitHubのPersonal Access Token（ghp_...）
 *   WORKER_SECRET   : 管理画面との合言葉（admin.js の WORKER_SECRET と同じ文字列）
 */

const GH_OWNER  = 'TSUBASAfly2sky';
const GH_REPO   = 'tokai-kojo-kenkyukai';
const GH_FILE   = 'data.json';
const GH_BRANCH = 'main';

export default {
  async fetch(request, env) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // プリフライトリクエスト（ブラウザの事前確認）への応答
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    // リクエストの内容を受け取る
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

    // Base64エンコード済みの data.json 内容が必要
    if (!body.content) {
      return json({ error: 'content がありません' }, 400, corsHeaders);
    }

    const ghBase = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${GH_FILE}`;
    const ghHeaders = {
      'Authorization': `token ${env.GH_PAT}`,
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'tokai-kojo-worker',
      'Content-Type': 'application/json',
    };

    // 現在のファイルの SHA を取得
    const shaRes = await fetch(`${ghBase}?ref=${GH_BRANCH}`, { headers: ghHeaders });
    if (!shaRes.ok) {
      const err = await shaRes.json().catch(() => ({}));
      return json({ error: 'SHA取得失敗: ' + (err.message || shaRes.status) }, 500, corsHeaders);
    }
    const { sha } = await shaRes.json();

    // data.json を更新
    const putRes = await fetch(ghBase, {
      method: 'PUT',
      headers: ghHeaders,
      body: JSON.stringify({
        message: 'コンテンツ更新（管理画面）',
        content: body.content,
        sha,
        branch: GH_BRANCH,
      }),
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

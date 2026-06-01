# 東海古城研究会 ホームページ — Claude Code 用プロジェクトメモ

このファイルは Claude Code がこのプロジェクトの文脈を理解するためのメモです。

## プロジェクト概要

- **団体**：東海古城研究会（1960年設立）
- **公開URL**：https://tokai-kojo-kenkyukai.jp/
- **GitHubリポジトリ**：https://github.com/TSUBASAfly2sky/tokai-kojo-kenkyukai
- **ホスティング**：GitHub Pages + 独自ドメイン
- **想定読者**：会員、入会希望者、城・歴史に興味がある一般の人

## 技術スタック

- 静的サイト（HTML / CSS / JavaScript）
- ビルドツール・フレームワーク**なし**（あえて素のHTMLで保守性を確保）
- データは `data.json` に集約
- 管理画面は localStorage を使ったブラウザ内編集
- お問い合わせフォームは Google Forms を iframe 埋め込み

## ファイル構成

```
.
├── index.html              トップページ（HERO・お知らせ・概要・活動・報告プレビュー・問合せ）
├── report.html             活動報告一覧（年フィルタ付き）
├── report-detail.html      活動報告詳細（?id=xxx で表示、写真ギャラリー付き）
├── admin.html              管理画面（パスワード保護、お知らせ・活動報告の編集）
├── data.json               サイトのコンテンツデータ（news / reports）
├── sitemap.xml             検索エンジン用
├── robots.txt              検索エンジン向けクロール設定（admin.html は除外）
├── CNAME                   独自ドメイン設定（tokai-kojo-kenkyukai.jp）
├── .nojekyll               GitHub Pages の Jekyll 処理を無効化
├── css/style.css           共通スタイル（CSS変数で和風カラー）
├── js/data.js              データ読み込み・共通ユーティリティ（TKK ネームスペース）
├── js/admin.js             管理画面ロジック（D&D写真・SHA-256パスワード・JSON書出など）
└── images/
    ├── hero.jpg            HEROの城のペン画（会報「城」229号の絵）
    └── hero.svg            旧HERO（参照されていないが残置）
```

## デザイン方針

- **配色**：`--color-primary: #5c3d1e`（深い茶）、`--color-accent: #a8884d`（金茶）系の和風セピア
- **フォント**：見出し Shippori Mincho B1、本文 Noto Sans JP、英文 Cormorant Garamond
- **HEROオーバーレイ**：白背景のペン画なので、白文字が読めるようセピア半透明オーバーレイ＋text-shadowで対応
- **トーン**：歴史研究会らしい落ち着いた品位、過度な装飾は避ける

## データ構造（data.json）

```json
{
  "news": [
    {
      "id": "news-xxxxx",
      "title": "見出し",
      "date": "2026-05-01",
      "content": "本文",
      "is_published": true
    }
  ],
  "reports": [
    {
      "id": "report-xxxxx",
      "title": "見出し",
      "date": "2026-04-20",
      "location": "犬山城（愛知県犬山市）",
      "content": "本文（段落は空行で区切り）",
      "images": ["data:image/jpeg;base64,..."],
      "is_published": true
    }
  ]
}
```

- 写真は **Base64データURL** で `images` 配列に格納（GitHubに画像を別アップロードしないで済む方式）
- 管理画面でドロップ時に長辺1200px・JPEG品質75%に自動圧縮（admin.js の compressImage）
- 旧フラグ名 `published` も互換読込（data.js の `TKK.isPublished()`）

## 運用フロー（コンテンツ更新）

1. ブラウザで `admin.html` を開いてログイン（初期パスワード：`tokai1960`、設定タブで変更可能）
2. お知らせ・活動報告をフォームで編集（写真はドロップゾーンに放り込めばOK）
3. 編集はブラウザの localStorage に保存される
4. **本番反映**：GitHub上で `data.json` を直接編集して Commit
   - ※ 現状、管理画面の編集を `data.json` に書き出す UI は削除済み
   - ※ 写真を含む反映フローについては要再検討（写真機能を活かすなら書き出し機能の再導入が必要）

## 公開フロー

- `main` ブランチへのプッシュで GitHub Pages が自動デプロイ
- 反映には数分かかる（Actions タブで状況確認可）

## 主な制約・注意点

- **静的サイトのため、サーバーサイド処理は一切なし**（バックエンドAPI、DB、フォーム送信などは使えない）
- **GitHub Pages 無料枠**：リポジトリ1GB推奨、1ファイル100MB
- **写真**：1報告につき6枚程度を推奨（Base64化で `data.json` が肥大化するため）
- **localStorage 容量**：通常5〜10MB上限、超過時は管理画面に警告表示
- **admin.html は robots.txt で除外済み**だが、URLを知っていればアクセスは可能（パスワード保護）
- お問い合わせフォームの差し替えは `index.html` の iframe `src` を書き換え

## 過去の作業履歴サマリ

このプロジェクトは Claude（claude.ai）との対話で段階的に構築されました。主な変更：

1. 初期構築（藍染め系→茶系セピア配色へリニューアル）
2. SEO対応（メタタグ、sitemap.xml、robots.txt、Google Search Console認証）
3. お知らせ詳細表示（`<details>` でアコーディオン化）
4. 活動報告の写真機能（ドラッグ&ドロップ + Base64 圧縮埋め込み）
5. HERO画像を会報「城」229号のペン画に差し替え
6. 文言ブラッシュアップ（HERO・概要・主な活動・問い合わせ説明）
7. JSON書き出し/読み込み機能の削除（要件変更による）

## 想定される今後の作業

- 写真付き報告の本番反映フロー再設計
- 管理画面 UI の継続的改善
- お知らせの定期更新
- 活動報告（写真付き）の継続追加
- SSL証明書まわりの最終確認（履歴上、未完了の可能性）
- パフォーマンス改善（画像最適化、`data.json` 分割など）

## コミュニケーション・スタイル

- 利用者（団体担当：岡田氏）はプログラミング初心者
- 関西弁・大学教授スタイルで案内を希望されている（Claude.ai 上での設定）
- 事務的に処理する方針

## よく使う作業の見本

### 文言修正
- `index.html` 内で該当箇所を `str_replace` で差し替え

### 新しい活動報告の追加
- `data.json` の `reports` 配列に新規オブジェクトを追加
- `id` は `report-` プレフィックス + ユニークな文字列

### 配色変更
- `css/style.css` 冒頭の `:root { --color-xxx: ... }` を変更

### お問い合わせ先の変更
- `index.html` の Google Forms iframe `src` URL を差し替え

# 東海古城研究会 ホームページ

愛知・岐阜・三重・静岡の古城・城跡を調査・研究する「東海古城研究会」のホームページです。
GitHub Pagesで公開できる静的サイトとして構築しています。

## ファイル構成

```
.
├── index.html       … トップページ
├── report.html      … 活動報告一覧ページ
├── admin.html       … 管理画面（パスワード保護）
├── data.json        … お知らせ・活動報告のデータ
├── css/
│   └── style.css    … スタイルシート
├── js/
│   ├── data.js      … データ読み込み・表示ロジック
│   └── admin.js     … 管理画面ロジック
├── .nojekyll        … GitHub Pages 用の設定ファイル
└── README.md        … この説明書
```

## GitHub Pages で公開する手順

### 📘 詳しい手順は [DEPLOY.md](DEPLOY.md) を参照してください

独自ドメイン `tokai-kojo-kenkyukai.jp` での公開手順を、画面操作レベルで丁寧に書いた完全マニュアルです。
初心者の方はこちらを順番にお読みください。

### 簡易版（経験者向け）

1. GitHubで新規Publicリポジトリ作成（例：`tokai-kojo-kenkyukai`）
2. このフォルダの中身を **全部**（`.nojekyll`・`CNAME` も含む）アップロード
3. Settings → Pages → Source を `main` / `/ (root)` に設定
4. Custom domain に `tokai-kojo-kenkyukai.jp` を入力して Save
5. ドメインのDNS設定で以下を追加：
   - **Aレコード×4**（ホスト名：`@`、値：`185.199.108.153` / `.109.153` / `.110.153` / `.111.153`）
   - **CNAMEレコード×1**（ホスト名：`www`、値：`（ユーザー名）.github.io.`）
6. DNS反映後（数十分〜数時間）、Settings → Pages で **Enforce HTTPS** にチェック

## 管理画面の使い方

### 初回ログイン

1. `https://(公開URL)/admin.html` にアクセス
2. パスワード： **`tokai1960`**
3. ログイン後、必ず「設定」タブからパスワードを変更してください

### お知らせ・活動報告の追加

1. 「お知らせ管理」または「活動報告管理」タブを開く
2. フォームに入力して「保存する」を押す
3. ブラウザ内（localStorage）に保存されます

### 公開サイトへの反映（重要）

管理画面で編集した内容は **そのブラウザ内にのみ保存** されます。
公開サイトに反映するには次の手順を実行してください：

1. 管理画面右上の **「📥 JSON書き出し」** をクリック → `data.json` がダウンロードされます
2. GitHubのリポジトリで `data.json` ファイルを開く
3. 鉛筆マーク（Edit）をクリック
4. 中身を全選択して削除し、ダウンロードした `data.json` の中身を貼り付け
5. 下部の「Commit changes」をクリック
6. 1〜2分後、公開サイトに反映されます

> 💡 **補足**：他のブラウザや別のPCで編集する場合は、まず「📤 JSON読み込み」で最新の `data.json` を読み込んでから編集してください。

## お問い合わせフォームについて

Googleフォームを iframe で埋め込んでいます。
フォームへの回答はGoogleスプレッドシートで管理できます。詳細は管理画面の「設定」タブをご参照ください。

フォームURL（変更時は `index.html` の `<iframe>` タグを修正）：
```
https://docs.google.com/forms/d/e/1FAIpQLSdv9U6BF75r1oWcRdBS3N-3Q_ptprey6gVxW3IBDNYQ6Gburg/viewform?embedded=true
```

## カスタマイズ

- **配色を変える**：`css/style.css` の冒頭 `:root { ... }` 内のカラー変数を編集
- **会の情報を変える**：`index.html` の `info-table` を編集
- **ロゴを変える**：`index.html` `report.html` `admin.html` 冒頭の `<svg class="logo-mark">` を編集

## ライセンス

このサイトのコードは自由に利用・改変いただけます。

# メダルキーパー

メダル預け期限管理Webアプリ。

## セットアップ手順

1. Firebase コンソールでプロジェクトを作成
2. Authentication で Google サインインを有効化
3. Firestore を有効化し、`medals` コレクションを利用
4. `firebase-config.js` に Firebase 設定を貼り付け
5. `firestore.rules` を Firebase コンソールに反映
6. `index.html` を GitHub Pages で公開

## 機能

### 基本機能
- Googleログイン / ログアウト
- メダルの登録・編集・削除
- 期限順の一覧表示
- 期限状態の色分け（緑・黄・赤）

### 期限延長機能
- 各メダルカードに「期限延長」ボタン
- 登録時に設定した延長日数に基づいて延長
- **現在の日付から延長日数を加算して新しい期限日を設定**
- 延長日数はメダルごとに個別に設定可能

## Firestore スキーマ

`medals` コレクションのドキュメント構造:

```json
{
  "title": "店舗名 / タイトル",
  "amount": 10,
  "extensionDays": 30,
  "expireDate": "Timestamp",
  "memo": "メモ（任意）",
  "createdBy": "ユーザーUID",
  "createdAt": "Timestamp"
}
```

- `index.html` - UI の基本構造
- `styles.css` - スタイル
- `main.js` - Firebase 認証・Firestore 連携ロジック
- `firebase-config.js` - Firebase 設定を記載するファイル
- `firestore.rules` - Firestore セキュリティルール

## 追加実装案

- Firebase Cloud Messaging（FCM）で期限通知
- PWA 化
- フィルタ / ソート
- CSV エクスポート
- LINE 通知連携

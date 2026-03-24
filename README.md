# PremierMD Document Follow-up Voice Agent

Retell AI API を使って **プログラマティックに** デプロイする Voice Agent。  
患者からの文書・FAX 関連の問い合わせを自動で受け付け、構造化されたデータをスタッフ用ダッシュボードに送信します。

## アーキテクチャ

```
患者 (電話)
    │
    ▼
┌─────────────────────────┐
│  Retell AI Platform     │
│  ┌───────────────────┐  │
│  │ Conversation Flow │  │  ← deploy-agent.js で作成
│  │  (15 nodes)       │  │
│  └───────────────────┘  │
│  ┌───────────────────┐  │
│  │ Voice Agent       │  │  ← voice_id, post_call_analysis 設定
│  └───────────────────┘  │
└─────────┬───────────────┘
          │ Webhook (JSON)
          ▼
┌─────────────────────────┐
│  webhook-server.js      │  ← 自社サーバー
│  - /webhooks/retell     │     (通話中: Function Node から)
│  - /webhooks/postcall   │     (通話後: Post-call Analysis)
└─────────┬───────────────┘
          │
          ▼
┌─────────────────────────┐
│  Dashboard / CRM        │  (Airtable, Google Sheets, DB, etc.)
│  - 患者名 + DOB         │
│  - 問い合わせ種別        │
│  - 緊急フラグ            │
│  - コールバック番号       │
└─────────────────────────┘
```

## 会話フローのノード構成

| # | Node ID | Type | 役割 |
|---|---------|------|------|
| 1 | `opening` | conversation | 挨拶 + 氏名/DOB 収集 |
| 2 | `extract_patient_info` | extract_dv | patient_name, patient_dob 抽出 |
| 3 | `identify_inquiry_type` | conversation | 問い合わせ種別の特定 |
| 4 | `extract_inquiry_type` | extract_dv | inquiry_type (enum: fax/records/status) |
| 5 | `logic_split_inquiry` | logic_split | 3分岐 |
| 6a | `fax_inquiry` | conversation | FAX 詳細ヒアリング |
| 6b | `records_request` | conversation | 医療記録リクエスト |
| 6c | `status_check` | conversation | 文書ステータス確認 |
| - | `extract_*_details` | extract_dv | 各パスの変数抽出 |
| 7 | `urgency_check` | logic_split | 緊急判定 |
| 8 | `transfer_to_staff` | call_transfer | 人間へハンドオフ (urgent) |
| 9 | `confirm_contact` | conversation | コールバック番号確認 |
| 10 | `extract_phone` | extract_dv | phone_number 抽出 |
| 11 | `next_steps` | conversation | 次のステップを案内 |
| 12 | `closing` | conversation | クロージング |
| 13 | `log_to_dashboard` | function | Webhook でデータ送信 |
| 14 | `end_call` | end_call | 通話終了 |

## セットアップ

### 1. インストール

```bash
npm install
```

### 2. 環境変数

`.env.example` をコピーして `.env` ファイルを作成し、必要な値を設定:

```bash
cp .env.example .env
```

`.env`:
```
RETELL_API_KEY=your_retell_api_key
WEBHOOK_URL=https://your-server.com/webhooks/retell
TRANSFER_NUMBER=+12125551234
```

### 3. デプロイ

```bash
npm run deploy
```

出力:
```
Step 1: Creating Conversation Flow...
   ✓ Conversation Flow created: cf_xxxxxxxxxxxx

Step 2: Creating Voice Agent...
   ✓ Voice Agent created: ag_xxxxxxxxxxxx
   ✓ Agent name: PremierMD Document Follow-up Agent
```

### 4. テスト

1. **Retell Dashboard** → Agents → 作成した Agent を選択
2. **Web Call Test** で通話テスト
3. 別途構築した Webhook サーバーにデータが送信されることを確認

## カスタマイズ

### Voice の変更

`src/deploy-agent.ts` の `voice_id` を変更:
```js
voice_id: "11labs-Dorothy",  // 穏やかな女性音声
```
利用可能な voice_id は Retell Dashboard の Voice Library で確認できます。

### LLM モデルの変更

```js
model_choice: {
  model: "claude-3.5-sonnet",  // Claude を使う場合
  type: "cascading",
},
```

### ノードの追加

例: SMS 確認の送信ノードを追加する場合:
```js
{
  id: "send_sms_confirmation",
  type: "sms",
  sms_content: "PremierMD: Your inquiry about {{doc_subject}} has been logged. We will call you at {{phone_number}} within 1 business day.",
  edges: [
    { destination_node_id: "end_call", condition: { type: "always" } }
  ],
}
```

### Dashboard 連携

別途構築する Webhook サーバーで、実際のデータストアに接続するコードを実装:

- **Airtable**: `airtable` npm パッケージ
- **Google Sheets**: `googleapis` npm パッケージ
- **PostgreSQL**: `pg` npm パッケージ
- **Slack 通知**: `@slack/web-api` npm パッケージ

このリポジトリは Agent のデプロイのみを担当します。

## GUI vs API — なぜ API を選んだか

| | GUI (Dashboard) | API (このアプローチ) |
|---|---|---|
| セットアップ速度 | 速い（ドラッグ&ドロップ） | やや遅い（コード記述） |
| 再現性 | 低い（手動操作） | 高い（コードで定義） |
| バージョン管理 | なし | Git で管理可能 |
| 環境の複製 | 手動コピー | `npm run deploy` で即座に |
| CI/CD 統合 | 不可 | 可能 |
| レビュー | 画面共有が必要 | PR レビュー可能 |
| テスト自動化 | 限定的 | Retell Batch Testing API と連携 |

API アプローチの最大のメリットは **Infrastructure as Code** として管理できること。  
Agent の設定変更をコードで追跡し、チームでレビューし、本番環境に安全にデプロイできます。

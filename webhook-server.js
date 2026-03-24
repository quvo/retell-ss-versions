/**
 * PremierMD Webhook Receiver
 * ==========================
 * Retell AI からのコールデータを受信し、ダッシュボード用に整形するサーバー。
 *
 * 受信するイベント:
 *   1. Custom Function 呼び出し (通話中のリアルタイムデータ送信)
 *   2. Post-call Webhook (通話終了後の分析データ)
 *
 * 使い方:
 *   npm install express
 *   node webhook-server.js
 */

import express from "express";
import crypto from "crypto";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const RETELL_WEBHOOK_SECRET = process.env.RETELL_WEBHOOK_SECRET || "your_secret_here";

// ─── Retell 署名検証 ───────────────────────────────────
function verifyRetellSignature(req) {
  const signature = req.headers["x-retell-signature"];
  if (!signature) return false;

  const body = JSON.stringify(req.body);
  const expected = crypto
    .createHmac("sha256", RETELL_WEBHOOK_SECRET)
    .update(body)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// ─── Custom Function Endpoint (通話中のデータ) ──────────────
// Retell の Function Node がこのエンドポイントを呼ぶ
app.post("/webhooks/retell", (req, res) => {
  console.log("\n━━━ Incoming webhook ━━━");
  console.log("Timestamp:", new Date().toISOString());

  const { call, args } = req.body;

  // ダッシュボードに表示するデータ構造に整形
  const caseRecord = {
    // ─ Patient identification ─
    patient_name: args?.patient_name || "Unknown",
    patient_dob: args?.patient_dob || "Unknown",

    // ─ Issue type ─
    inquiry_type: args?.inquiry_type || "unknown",

    // ─ Document details ─
    doc_subject: args?.doc_subject || "",
    doc_date_sent: args?.doc_date_sent || "",
    doc_method: args?.doc_method || "",
    doc_confirmation_number: args?.doc_confirmation_number || "",
    doc_purpose: args?.doc_purpose || "",
    records_destination: args?.records_destination || "",

    // ─ Urgency & contact ─
    is_urgent: args?.is_urgent === "true",
    phone_number: args?.phone_number || "",

    // ─ Metadata ─
    call_id: call?.call_id || "unknown",
    agent_id: call?.agent_id || "unknown",
    timestamp: new Date().toISOString(),
    source: "retell_function_call",
  };

  console.log("\n📋 Case Record:");
  console.log(JSON.stringify(caseRecord, null, 2));

  // ── ここで実際のダッシュボードにデータを送る ──
  // 例:
  // - Airtable: await airtableBase('Cases').create([{ fields: caseRecord }]);
  // - Google Sheets: await sheets.spreadsheets.values.append(...)
  // - PostgreSQL: await db.query('INSERT INTO cases ...', caseRecord);
  // - Slack通知: await slack.chat.postMessage({ channel, text: formatSlackMessage(caseRecord) });

  // 🚨 緊急ケースの場合、追加アクション
  if (caseRecord.is_urgent) {
    console.log("🚨 URGENT CASE DETECTED — triggering staff notification");
    // await sendUrgentNotification(caseRecord);
  }

  res.json({ ok: true, message: "Case logged successfully" });
});

// ─── Post-call Webhook (通話終了後) ─────────────────────
app.post("/webhooks/retell/postcall", (req, res) => {
  console.log("\n━━━ Post-call event ━━━");

  const {
    call_id,
    agent_id,
    call_status,
    duration_ms,
    transcript,
    collected_dynamic_variables,
    call_analysis,
  } = req.body;

  const postCallRecord = {
    call_id,
    agent_id,
    status: call_status,
    duration_seconds: Math.round((duration_ms || 0) / 1000),
    transcript_preview: transcript?.substring(0, 500) || "",

    // Dynamic Variables (通話中に抽出された値)
    variables: collected_dynamic_variables || {},

    // AI分析結果
    analysis: {
      summary: call_analysis?.call_summary || "",
      successful: call_analysis?.call_successful || false,
      user_sentiment: call_analysis?.user_sentiment || "unknown",
      custom_data: call_analysis?.custom_analysis_data || {},
    },

    timestamp: new Date().toISOString(),
  };

  console.log("📊 Post-call Analysis:");
  console.log(JSON.stringify(postCallRecord, null, 2));

  // ダッシュボードの既存レコードを通話後分析で補完
  // await updateCaseWithPostCallData(call_id, postCallRecord);

  res.json({ ok: true });
});

// ─── Health check ───────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ status: "healthy", service: "premiermd-webhook-receiver" });
});

// ─── 起動 ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🏥 PremierMD Webhook Server running on port ${PORT}`);
  console.log(`   Custom function endpoint: POST /webhooks/retell`);
  console.log(`   Post-call endpoint:       POST /webhooks/retell/postcall`);
  console.log(`   Health check:             GET  /health\n`);
});

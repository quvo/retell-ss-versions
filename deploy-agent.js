/**
 * PremierMD Document Follow-up Voice Agent
 * ==========================================
 * Retell AI API を使ってConversation Flow Agentをプログラマティックに作成するスクリプト
 *
 * 使い方:
 *   1. npm install retell-sdk
 *   2. RETELL_API_KEY 環境変数をセット
 *   3. WEBHOOK_URL を自分のエンドポイントに変更
 *   4. node deploy-agent.js
 *
 * 処理の流れ:
 *   Step 1: Conversation Flow (ノード + 遷移条件) を作成
 *   Step 2: Voice Agent を作成し、Conversation Flow を紐づけ
 *   Step 3: 電話番号を割り当て（オプション）
 */

import Retell from "retell-sdk";

// ─── 設定 ──────────────────────────────────────────────
const RETELL_API_KEY = process.env.RETELL_API_KEY;
const WEBHOOK_URL = process.env.WEBHOOK_URL || "https://your-server.com/webhooks/retell";
const TRANSFER_NUMBER = process.env.TRANSFER_NUMBER || "+12125551234"; // スタッフの番号

if (!RETELL_API_KEY) {
  console.error("Error: RETELL_API_KEY environment variable is required.");
  process.exit(1);
}

const client = new Retell({ apiKey: RETELL_API_KEY });

// ─── ノード定義 ──────────────────────────────────────────
// 各ノードの ID は他のノードの transition 条件から参照されるため、
// わかりやすい命名にしている

const nodes = [
  // ━━━ Node 1: Opening / Greeting ━━━
  {
    id: "opening",
    type: "conversation",
    instruction: {
      type: "static_sentence",
      text: "Thank you for calling PremierMD. I can help you with document and fax inquiries. May I have your full name and date of birth, please?",
    },
    // Conversation Node は Static Sentence を発話後、ユーザーの応答を待ち、
    // 必要に応じてマルチターンで情報を収集する
    additional_prompt:
      "Collect the patient's full name and date of birth. " +
      "If the patient provides only one, politely ask for the other. " +
      "Confirm both by repeating them back. " +
      "If unclear, ask the patient to spell their name or repeat their date of birth.",
    edges: [
      {
        destination_node_id: "extract_patient_info",
        condition: {
          type: "prompt",
          text: "Patient has provided both their full name and date of birth, and agent has confirmed them.",
        },
      },
    ],
  },

  // ━━━ Node 2: Extract Patient Info ━━━
  {
    id: "extract_patient_info",
    type: "extract_dv",
    variables: [
      {
        name: "patient_name",
        type: "text",
        description: "The patient's full name as stated by the patient",
      },
      {
        name: "patient_dob",
        type: "text",
        description: "The patient's date of birth (e.g. January 15, 1985 or 01/15/1985)",
      },
    ],
    edges: [
      {
        destination_node_id: "identify_inquiry_type",
        condition: {
          type: "always",
          skip_user_response: true,
        },
      },
    ],
  },

  // ━━━ Node 3: Identify Inquiry Type ━━━
  {
    id: "identify_inquiry_type",
    type: "conversation",
    instruction: {
      type: "prompt",
      text:
        "Ask the patient what type of document inquiry they are calling about. " +
        "Present three clear options:\n" +
        "1. Following up on a fax they sent\n" +
        "2. Requesting medical records\n" +
        "3. Checking on the status of a previously submitted document\n\n" +
        "If the patient's answer is vague or doesn't fit these categories, " +
        "ask clarifying questions. Do not move on until the inquiry type is clearly identified.",
    },
    edges: [
      {
        destination_node_id: "extract_inquiry_type",
        condition: {
          type: "prompt",
          text: "The patient has clearly indicated their inquiry type (fax follow-up, medical records request, or document status check).",
        },
      },
    ],
  },

  // ━━━ Node 4: Extract Inquiry Type ━━━
  {
    id: "extract_inquiry_type",
    type: "extract_dv",
    variables: [
      {
        name: "inquiry_type",
        type: "enum",
        description: "The type of document inquiry",
        options: ["fax", "records", "status"],
      },
    ],
    edges: [
      {
        destination_node_id: "logic_split_inquiry",
        condition: {
          type: "always",
          skip_user_response: true,
        },
      },
    ],
  },

  // ━━━ Node 5: Logic Split — Inquiry Type ━━━
  {
    id: "logic_split_inquiry",
    type: "logic_split",
    edges: [
      {
        destination_node_id: "fax_inquiry",
        condition: {
          type: "equation",
          text: '{{inquiry_type}} == "fax"',
        },
      },
      {
        destination_node_id: "records_request",
        condition: {
          type: "equation",
          text: '{{inquiry_type}} == "records"',
        },
      },
      {
        destination_node_id: "status_check",
        condition: {
          type: "equation",
          text: '{{inquiry_type}} == "status"',
        },
      },
      {
        // Else: 型が特定できなかった → 聞き直し
        destination_node_id: "identify_inquiry_type",
        condition: { type: "else" },
      },
    ],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  PATH A: Fax Follow-up
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // ━━━ Node 6a: Fax Inquiry ━━━
  {
    id: "fax_inquiry",
    type: "conversation",
    instruction: {
      type: "prompt",
      text:
        "The patient is calling about a fax they sent to PremierMD. " +
        "Collect the following in a natural conversational flow:\n" +
        "1. When did they send the fax? (get a specific date or approximate timeframe)\n" +
        "2. What was the fax about? (referral, medical records, insurance forms, prior authorization, other)\n" +
        "3. Do they have a confirmation number or cover page with tracking info?\n\n" +
        "If any answer is vague, ask a follow-up. " +
        "If the patient mentions urgency (surgery tomorrow, prior auth deadline, etc.), " +
        "acknowledge their concern empathetically and note the urgency.",
    },
    edges: [
      {
        destination_node_id: "extract_fax_details",
        condition: {
          type: "prompt",
          text: "All fax-related information has been collected: date sent, subject/purpose, and whether they have a confirmation number.",
        },
      },
    ],
  },

  // ━━━ Node 6a-ext: Extract Fax Details ━━━
  {
    id: "extract_fax_details",
    type: "extract_dv",
    variables: [
      {
        name: "doc_date_sent",
        type: "text",
        description: "The date the fax was sent",
      },
      {
        name: "doc_subject",
        type: "text",
        description: "The subject or purpose of the fax (e.g. referral, medical records, insurance forms)",
      },
      {
        name: "doc_confirmation_number",
        type: "text",
        description: "Fax confirmation or tracking number, or 'none' if not available",
      },
      {
        name: "doc_method",
        type: "text",
        description: "How the document was sent. For this path, always 'fax'",
      },
      {
        name: "is_urgent",
        type: "boolean",
        description: "True if the patient indicated urgency (upcoming surgery, deadline, repeated follow-ups, frustration)",
      },
    ],
    edges: [
      {
        destination_node_id: "urgency_check",
        condition: { type: "always", skip_user_response: true },
      },
    ],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  PATH B: Medical Records Request
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // ━━━ Node 6b: Records Request ━━━
  {
    id: "records_request",
    type: "conversation",
    instruction: {
      type: "prompt",
      text:
        "The patient is requesting medical records. Collect:\n" +
        "1. What type of records do they need? (therapy notes, medication history, complete file, lab results, imaging, other)\n" +
        "2. Where do these records need to be sent? (another doctor, insurance company, the patient themselves, attorney, etc.)\n" +
        "3. Is there a specific deadline or timeframe?\n\n" +
        "Let the patient know that medical records requests typically take 5 to 7 business days to process. " +
        "If they mention urgency, acknowledge it and note it.",
    },
    edges: [
      {
        destination_node_id: "extract_records_details",
        condition: {
          type: "prompt",
          text: "All records request information has been collected: record type, destination, and any deadline.",
        },
      },
    ],
  },

  // ━━━ Node 6b-ext: Extract Records Details ━━━
  {
    id: "extract_records_details",
    type: "extract_dv",
    variables: [
      {
        name: "doc_subject",
        type: "text",
        description: "Type of medical records requested (therapy notes, medication history, complete file, etc.)",
      },
      {
        name: "records_destination",
        type: "text",
        description: "Where records need to be sent",
      },
      {
        name: "doc_date_sent",
        type: "text",
        description: "Deadline or timeframe for records, or 'none' if no deadline",
      },
      {
        name: "doc_method",
        type: "text",
        description: "How records will be sent. Set to 'records_request'",
      },
      {
        name: "is_urgent",
        type: "boolean",
        description: "True if there is time pressure or patient expressed urgency",
      },
    ],
    edges: [
      {
        destination_node_id: "urgency_check",
        condition: { type: "always", skip_user_response: true },
      },
    ],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  PATH C: Document Status Check
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // ━━━ Node 6c: Status Check ━━━
  {
    id: "status_check",
    type: "conversation",
    instruction: {
      type: "prompt",
      text:
        "The patient is checking on the status of a previously submitted document. Collect:\n" +
        "1. What document are they checking on? (be specific: referral, lab order, insurance form, etc.)\n" +
        "2. When was it submitted?\n" +
        "3. How was it submitted? (fax, email, patient portal, in-person, mail)\n" +
        "4. What is the purpose of the document?\n\n" +
        "If the patient seems frustrated about repeated follow-ups, acknowledge their concern " +
        "and note the urgency.",
    },
    edges: [
      {
        destination_node_id: "extract_status_details",
        condition: {
          type: "prompt",
          text: "Document status details have been collected: document name/type, submission date, submission method.",
        },
      },
    ],
  },

  // ━━━ Node 6c-ext: Extract Status Details ━━━
  {
    id: "extract_status_details",
    type: "extract_dv",
    variables: [
      {
        name: "doc_subject",
        type: "text",
        description: "Name or type of the document being checked",
      },
      {
        name: "doc_date_sent",
        type: "text",
        description: "When the document was submitted",
      },
      {
        name: "doc_method",
        type: "enum",
        description: "How the document was submitted",
        options: ["fax", "email", "portal", "in_person", "mail", "other"],
      },
      {
        name: "doc_purpose",
        type: "text",
        description: "The purpose of the document",
      },
      {
        name: "is_urgent",
        type: "boolean",
        description: "True if the patient indicated urgency or frustration from repeated follow-ups",
      },
    ],
    edges: [
      {
        destination_node_id: "urgency_check",
        condition: { type: "always", skip_user_response: true },
      },
    ],
  },

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  共通: Urgency → Contact → Close
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // ━━━ Node 7: Urgency Check (Logic Split) ━━━
  {
    id: "urgency_check",
    type: "logic_split",
    edges: [
      {
        destination_node_id: "transfer_to_staff",
        condition: {
          type: "equation",
          text: "{{is_urgent}} == true",
        },
      },
      {
        destination_node_id: "confirm_contact",
        condition: { type: "else" },
      },
    ],
  },

  // ━━━ Node 8: Call Transfer (Urgent cases) ━━━
  {
    id: "transfer_to_staff",
    type: "call_transfer",
    transfer_to: TRANSFER_NUMBER,
    speak_during_execution: {
      type: "prompt",
      text:
        "I understand this is urgent. Let me connect you with a team member " +
        "who can assist you right away. Please hold for just a moment.",
    },
    // Call Transfer Node はここで通話を人間に引き渡す
    // 引き渡し後のフローは不要（人間が対応する）
  },

  // ━━━ Node 9: Confirm Contact Number ━━━
  {
    id: "confirm_contact",
    type: "conversation",
    instruction: {
      type: "prompt",
      text:
        "Confirm the patient's callback phone number. " +
        "Ask: 'What is the best phone number for us to reach you?' " +
        "If the patient provides a number, repeat it back to confirm. " +
        "If they correct it, update and re-confirm.",
    },
    edges: [
      {
        destination_node_id: "extract_phone",
        condition: {
          type: "prompt",
          text: "Patient has confirmed their callback phone number.",
        },
      },
    ],
  },

  // ━━━ Node 10: Extract Phone Number ━━━
  {
    id: "extract_phone",
    type: "extract_dv",
    variables: [
      {
        name: "phone_number",
        type: "text",
        description: "The patient's preferred callback phone number",
      },
    ],
    edges: [
      {
        destination_node_id: "next_steps",
        condition: { type: "always", skip_user_response: true },
      },
    ],
  },

  // ━━━ Node 11: Communicate Next Steps ━━━
  {
    id: "next_steps",
    type: "conversation",
    instruction: {
      type: "prompt",
      text:
        "Based on the {{inquiry_type}}, deliver the appropriate next steps message:\n\n" +
        "If inquiry_type is 'fax':\n" +
        "  'I'll check with our medical records team, and they will call you back " +
        "at {{phone_number}} within 1 business day to confirm receipt.'\n\n" +
        "If inquiry_type is 'records':\n" +
        "  'Medical records requests typically take 5 to 7 business days to process. " +
        "You will receive confirmation once they have been sent.'\n\n" +
        "If inquiry_type is 'status':\n" +
        "  'I will have our administrative team review the status and call you back " +
        "at {{phone_number}} within 1 business day.'\n\n" +
        "Deliver the message warmly and clearly.",
    },
    edges: [
      {
        destination_node_id: "closing",
        condition: {
          type: "prompt",
          text: "Agent has communicated the next steps to the patient.",
        },
      },
    ],
  },

  // ━━━ Node 12: Closing ━━━
  {
    id: "closing",
    type: "conversation",
    instruction: {
      type: "static_sentence",
      text: "Your document inquiry has been logged. Is there anything else I can assist you with today?",
    },
    edges: [
      {
        destination_node_id: "log_to_dashboard",
        condition: {
          type: "prompt",
          text: "Patient says no, they have no more questions, or indicates they are done.",
        },
      },
      {
        destination_node_id: "identify_inquiry_type",
        condition: {
          type: "prompt",
          text: "Patient has another question or a different inquiry.",
        },
      },
    ],
  },

  // ━━━ Node 13: Function — Log to Dashboard ━━━
  {
    id: "log_to_dashboard",
    type: "function",
    function_id: "log_case", // tools 配列の中で定義する名前と対応
    speak_during_execution: null, // 無言で裏側で送信
    wait_for_result: false,
    edges: [
      {
        destination_node_id: "end_call",
        condition: { type: "always", skip_user_response: true },
      },
    ],
  },

  // ━━━ Node 14: End Call ━━━
  {
    id: "end_call",
    type: "end_call",
    // End Node — 静かに通話を終了
  },
];

// ─── Tool 定義 (Custom Function: Webhook) ──────────────────
const tools = [
  {
    type: "custom",
    name: "log_case",
    description: "Log the document inquiry case to the PremierMD dashboard via webhook",
    tool_id: "log_case",
    url: WEBHOOK_URL,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Source": "retell-premiermd-agent",
    },
    // パラメータは Dynamic Variable を const で参照する
    parameters: {
      type: "object",
      properties: {
        patient_name: {
          type: "string",
          const: "{{patient_name}}",
        },
        patient_dob: {
          type: "string",
          const: "{{patient_dob}}",
        },
        inquiry_type: {
          type: "string",
          const: "{{inquiry_type}}",
        },
        doc_subject: {
          type: "string",
          const: "{{doc_subject}}",
        },
        doc_date_sent: {
          type: "string",
          const: "{{doc_date_sent}}",
        },
        doc_method: {
          type: "string",
          const: "{{doc_method}}",
        },
        doc_confirmation_number: {
          type: "string",
          const: "{{doc_confirmation_number}}",
        },
        doc_purpose: {
          type: "string",
          const: "{{doc_purpose}}",
        },
        records_destination: {
          type: "string",
          const: "{{records_destination}}",
        },
        is_urgent: {
          type: "string",
          const: "{{is_urgent}}",
        },
        phone_number: {
          type: "string",
          const: "{{phone_number}}",
        },
      },
    },
  },
];

// ─── Global Prompt ───────────────────────────────────────
const globalPrompt = `You are a professional and empathetic receptionist at PremierMD, a medical office.

ROLE:
- You handle document and fax follow-up inquiries ONLY.
- You do NOT provide medical advice, diagnose conditions, or discuss treatment plans.
- You do NOT schedule appointments — if asked, politely direct the patient to call the scheduling line.

TONE & STYLE:
- Calm, warm, professional, and patient.
- Use simple language — avoid medical jargon unless the patient uses it first.
- Always confirm information by repeating it back before proceeding.
- If the patient seems frustrated or anxious, acknowledge their feelings before continuing.

SENSITIVE SITUATIONS:
- If a patient mentions urgency (upcoming surgery, time-sensitive deadline, prior authorization expiring), express empathy and flag the case as urgent.
- If a patient says they have called multiple times about the same issue, apologize for the inconvenience and escalate.
- Never promise specific outcomes — use language like "our team will review" rather than "we will resolve this."

DYNAMIC VARIABLES AVAILABLE:
- {{patient_name}}: patient's full name
- {{patient_dob}}: date of birth
- {{inquiry_type}}: fax | records | status
- {{phone_number}}: callback number
- Use these variables in your responses when addressing the patient by name or confirming information.`;

// ─── メイン実行 ───────────────────────────────────────────
async function main() {
  console.log("╔══════════════════════════════════════════════════╗");
  console.log("║  PremierMD Document Follow-up Agent Deployer    ║");
  console.log("╚══════════════════════════════════════════════════╝\n");

  // ── Step 1: Create Conversation Flow ──
  console.log("Step 1: Creating Conversation Flow...");

  const conversationFlow = await client.conversationFlow.create({
    model_choice: {
      model: "gpt-4.1",
      type: "cascading", // コスト最適化: 簡単なノードは軽量モデル、複雑なノードは上位モデル
    },
    nodes: nodes,
    tools: tools,
    global_prompt: globalPrompt,
    start_node_id: "opening",
    start_speaker: "agent", // Agent が先に話し始める
    default_dynamic_variables: {
      // 未設定のまま参照されてもエラーにならないように初期値を設定
      patient_name: "",
      patient_dob: "",
      inquiry_type: "",
      doc_subject: "",
      doc_date_sent: "",
      doc_method: "",
      doc_confirmation_number: "",
      doc_purpose: "",
      records_destination: "",
      is_urgent: "false",
      phone_number: "",
    },
  });

  const flowId = conversationFlow.conversation_flow_id;
  console.log(`   ✓ Conversation Flow created: ${flowId}\n`);

  // ── Step 2: Create Voice Agent ──
  console.log("Step 2: Creating Voice Agent...");

  const agent = await client.agent.create({
    agent_name: "PremierMD Document Follow-up Agent",
    description: "Handles inbound patient calls about document/fax follow-ups, medical records requests, and document status checks.",

    // Response Engine: 先ほど作った Conversation Flow を紐づけ
    response_engine: {
      type: "conversation_flow",
      conversation_flow_id: flowId,
    },

    // Voice 設定 (Dashboard で利用可能な voice_id を確認してください)
    // 以下は例。実際の voice_id は Retell Dashboard から取得する
    voice_id: "11labs-Adrian", // 落ち着いた男性音声の例

    // 言語
    language: "en-US",

    // 応答の速さ: 0.6 = やや落ち着いたペース (医療系に適切)
    responsiveness: 0.6,

    // 割り込み感度: 0.5 = 中程度 (患者が話し終わるまで待つ)
    interruption_sensitivity: 0.5,

    // Backchannel（相づち）有効化
    enable_backchannel: true,

    // Post-call analysis（通話後の自動分析）
    post_call_analysis_data: [
      {
        type: "string",
        name: "patient_name",
        description: "The name of the patient who called.",
        examples: ["John Smith", "Maria Garcia"],
        required: true,
      },
      {
        type: "string",
        name: "inquiry_type",
        description: "The type of inquiry: fax, records, or status.",
        examples: ["fax", "records", "status"],
        required: true,
      },
      {
        type: "boolean",
        name: "was_urgent",
        description: "Whether the case was flagged as urgent.",
        required: true,
      },
      {
        type: "boolean",
        name: "was_transferred",
        description: "Whether the call was transferred to a human staff member.",
        required: true,
      },
      {
        type: "string",
        name: "resolution_summary",
        description: "A brief summary of what was communicated to the patient about next steps.",
        required: true,
      },
    ],
    analysis_summary_prompt:
      "Summarize this call: what the patient needed, what information was collected, " +
      "and what next steps were communicated. Flag if urgent.",
    analysis_successful_prompt:
      "The agent successfully collected all required information (name, DOB, inquiry details, callback number) " +
      "and communicated clear next steps, OR successfully transferred the call to staff for urgent cases.",
    analysis_user_sentiment_prompt:
      "Evaluate the patient's satisfaction: were they calm, neutral, frustrated, or anxious? " +
      "Did the agent handle their emotional state appropriately?",

    // Webhook for real-time events
    webhook_url: WEBHOOK_URL,

    // 最初の発話前に少し待つ（呼び出し音の余韻をなくす）
    begin_message_delay_ms: 800,
  });

  console.log(`   ✓ Voice Agent created: ${agent.agent_id}`);
  console.log(`   ✓ Agent name: ${agent.agent_name}\n`);

  // ── Step 3: (オプション) 電話番号の割り当て ──
  // 既に Retell で購入済みの番号がある場合、ここで紐づける
  // 新規購入する場合は Dashboard から行うか、API で購入する
  //
  // console.log("Step 3: Assigning phone number...");
  // const phoneNumber = await client.phoneNumber.create({
  //   area_code: 212,        // NY area code
  //   inbound_agent_id: agent.agent_id,
  //   nickname: "PremierMD Document Line",
  // });
  // console.log(`   ✓ Phone number: ${phoneNumber.phone_number}\n`);

  // ── Summary ──
  console.log("═══════════════════════════════════════════════════");
  console.log("  Deployment complete!");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Conversation Flow ID : ${flowId}`);
  console.log(`  Agent ID             : ${agent.agent_id}`);
  console.log(`  Webhook URL          : ${WEBHOOK_URL}`);
  console.log(`  Transfer Number      : ${TRANSFER_NUMBER}`);
  console.log("");
  console.log("  Next steps:");
  console.log("  1. Go to Retell Dashboard → test with Web Call");
  console.log("  2. Assign a phone number to this agent");
  console.log("  3. Set up your webhook endpoint to receive call data");
  console.log("  4. Run simulation tests with various scenarios");
  console.log("═══════════════════════════════════════════════════");
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PremierMD Document Follow-up Voice Agent - A voice agent deployed programmatically using Retell AI API. Handles patient calls about document/fax inquiries and sends structured data to a webhook endpoint.

**Key principle**: Infrastructure as Code approach - the entire agent is defined in code for version control, CI/CD integration, and team review.

**Stack**: TypeScript, Retell AI SDK v5.9.0, dotenv for configuration.

**Important**: This codebase uses Retell AI SDK v5 which has significantly different API from v3/v4. Key changes:
- Node types: `branch` (not `logic_split`), `extract_dynamic_variables` (not `extract_dv`), `function` (not `tool_call`)
- `branch` nodes require `else_edge` as separate field
- `extract_dynamic_variables` nodes do NOT have `instruction` field
- `transfer_call` nodes require `edge`, `transfer_option`, and `transfer_destination` with specific structure
- `function` nodes require `tool_type: "local" | "shared"`
- Variable types: `string` (not `text`), `enum` with `choices` (not `options`)

## Development Commands

```bash
# Install dependencies
npm install

# Deploy agent to Retell AI (creates conversation flow + voice agent)
npm run deploy

# Type check
npm run type-check

# Build TypeScript to JavaScript
npm run build
```

## Environment Variables

Create a `.env` file based on `.env.example`:

Required for deployment:
- `RETELL_API_KEY`: Retell AI API key (required)
- `WEBHOOK_URL`: URL where your separate webhook server is hosted (required)
- `TRANSFER_NUMBER`: Phone number for urgent call transfers (default: +12125551234)

The webhook server is implemented separately from this repository. This codebase only handles agent deployment.

## Architecture

### Single-File Structure

**src/deploy-agent.ts**: Programmatically creates the Retell AI agent (TypeScript, SDK v5)
- Defines 15-node conversation flow
- Configures voice agent settings
- Sets up custom function tool for webhook integration
- Uses Retell SDK to deploy everything via API
- Reads configuration from .env file

The webhook server that receives call data is implemented separately in a different repository/service.

### Conversation Flow Design

The agent uses a 15-node conversation flow with three main inquiry paths:

```
opening → extract_patient_info → identify_inquiry_type → extract_inquiry_type
                                                              ↓
                                                    logic_split_inquiry
                                                    ↓       ↓        ↓
                                              fax_inquiry  records  status_check
                                                    ↓        ↓         ↓
                                            extract_fax  extract_records  extract_status
                                                    ↓        ↓         ↓
                                                    urgency_check ←──────┘
                                                    ↓              ↓
                                          transfer_to_staff   confirm_contact
                                                                   ↓
                                                              extract_phone
                                                                   ↓
                                                              next_steps
                                                                   ↓
                                                               closing
                                                                   ↓
                                                            log_to_dashboard
                                                                   ↓
                                                               end_call
```

**Node Types Used**:
- `conversation`: Multi-turn conversation with prompts
- `extract_dv`: Extract dynamic variables from conversation
- `logic_split`: Branch based on variable values
- `function`: Call custom webhook (sends data to dashboard)
- `call_transfer`: Transfer to human staff (for urgent cases)
- `end_call`: End the conversation

### Dynamic Variables

Variables extracted during conversation and accessible across nodes:
- `patient_name`, `patient_dob`: Patient identification
- `inquiry_type`: enum ["fax", "records", "status"]
- `doc_subject`, `doc_date_sent`, `doc_method`, `doc_confirmation_number`, `doc_purpose`: Document details
- `records_destination`: For medical records requests
- `is_urgent`: Boolean flag triggering call transfer
- `phone_number`: Callback number

### Custom Function Integration

The `log_to_dashboard` function node POSTs to `WEBHOOK_URL` with all collected variables. Parameters use `const: "{{variable_name}}"` syntax to reference dynamic variables.

## Working with This Codebase

### Modifying the Conversation Flow

All conversation flow logic is in the `nodes` array in src/deploy-agent.ts:
- Each node must have a unique `id`
- Nodes reference each other via `destination_node_id` in edges
- Use `type: "prompt"` conditions for LLM-based transitions
- Use `type: "equation"` for variable-based branching
- Use `skip_user_response: true` in extract nodes to prevent waiting for user input

### Adding a New Node

Insert into the `nodes` array at the appropriate position in the flow:
```javascript
{
  id: "new_node_id",
  type: "conversation",
  instruction: { type: "prompt", text: "..." },
  edges: [
    {
      destination_node_id: "next_node",
      condition: { type: "prompt", text: "transition criteria" }
    }
  ]
}
```

Then update the previous node's edges to point to your new node.

### Adding Dynamic Variables

1. Add to extraction node's `variables` array:
```javascript
{
  name: "variable_name",
  type: "text", // or "boolean", "enum"
  description: "What this variable represents"
}
```

2. Add to `default_dynamic_variables` in the conversation flow creation (line 651)
3. Add to `log_to_dashboard` function parameters if needed for webhook

### Changing Voice or Model

In the agent creation section (line 673+):
- `voice_id`: Check Retell Dashboard Voice Library for available voices
- `model_choice.model`: Options include "gpt-4.1", "claude-3.5-sonnet", etc.
- `responsiveness`: 0.6 is calm pace (suitable for medical); higher = faster
- `interruption_sensitivity`: 0.5 is moderate; lower = agent talks more

### Webhook Integration

The agent sends data to the webhook URL specified in WEBHOOK_URL environment variable. The webhook endpoint should:
- Accept POST requests at the configured endpoint
- Handle call data with fields: patient_name, patient_dob, inquiry_type, doc_subject, etc.
- Implement storage logic (Airtable, Google Sheets, PostgreSQL, etc.)
- Handle urgent notifications when is_urgent flag is true
- Optionally handle post-call analysis data at a separate endpoint

### Post-call Analysis

Configured in `post_call_analysis_data` array (line 700). The AI analyzes the conversation and extracts:
- Structured fields (patient_name, inquiry_type, was_urgent, was_transferred)
- Free-form summary based on `analysis_summary_prompt`
- Success criteria from `analysis_successful_prompt`
- Sentiment analysis from `analysis_user_sentiment_prompt`

## Testing

1. Set up your `.env` file with required environment variables
2. Run `npm run deploy` to create the agent in Retell
3. Go to Retell Dashboard → Agents → select your agent
4. Use "Web Call Test" to simulate calls
5. Ensure your webhook server is running and accessible
6. Test all three inquiry paths: fax, records, and status
7. Test urgent vs non-urgent scenarios

## Important Notes

- Each `npm run deploy` creates a NEW conversation flow and agent (does not update existing ones)
- To update: manually update via Dashboard, or delete old agent and redeploy
- The `global_prompt` defines agent personality and behavior constraints
- Never modify medical advice scope - agent is strictly for document inquiries only
- The webhook server implementation is separate from this codebase

#!/bin/bash
set -e

echo "=== Simulating workflow ==="

# Create test output
cat > snapshot-output-test.log <<'LOGEOF'
> retell-snapshots@1.0.0 snapshot-collect
> tsx src/snapshot-collector.ts

🔍 Starting snapshot collection...

📊 Summary:
{
  "flows": [
    {
      "id": "507f7e8ba37a",
      "oldVersion": 4,
      "newVersion": 5
    }
  ],
  "agents": [],
  "components": [],
  "totalNew": 1,
  "timestamp": "2026-04-18T02:04:36.146Z"
}

✅ Collection complete! 1 new snapshots captured.
LOGEOF

echo "1. Extract JSON summary"
sed -n '/📊 Summary:/,/^}$/p' snapshot-output-test.log | tail -n +2 > snapshot-summary-test.json
cat snapshot-summary-test.json
echo ""

echo "2. Parse with jq"
jq -r '.totalNew' snapshot-summary-test.json
echo ""

echo "3. Check if valid JSON"
jq empty snapshot-summary-test.json && echo "✓ Valid JSON" || echo "✗ Invalid JSON"

rm snapshot-output-test.log snapshot-summary-test.json

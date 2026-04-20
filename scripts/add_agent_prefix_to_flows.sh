#!/bin/zsh

# Add agent name prefix to flow filenames
# Format: {agent_name}_conversation_flow_{flow_id}.json

AGENTS_DIR="snapshots/agents"
FLOWS_DIR="snapshots/flows"

echo "=== Building Flow → Agent mapping ==="

# Create associative array for flow_id → agent_name mapping
typeset -A FLOW_TO_AGENT

# Scan all agents to find their conversation_flow_id
for agent_file in "$AGENTS_DIR"/*.json; do
  [ "$agent_file" = "$AGENTS_DIR/index.json" ] && continue
  [ ! -f "$agent_file" ] && continue

  agent_name=$(jq -r '.agent_name // empty' "$agent_file")
  flow_id=$(jq -r '.response_engine.conversation_flow_id // empty' "$agent_file")

  if [ -n "$flow_id" ] && [ -n "$agent_name" ]; then
    # Sanitize agent name
    sanitized_name=$(echo "$agent_name" | sed 's/ /_/g' | sed 's/[\/()]/_/g' | sed 's/__*/_/g' | sed 's/^_//;s/_$//')
    FLOW_TO_AGENT[$flow_id]="$sanitized_name"
    echo "  $flow_id -> $sanitized_name"
  fi
done

echo ""
echo "=== Renaming flow files with agent prefix ==="

renamed_count=0
skipped_count=0

for flow_file in "$FLOWS_DIR"/conversation_flow_*.json; do
  [ "$flow_file" = "$FLOWS_DIR/index.json" ] && continue
  [ ! -f "$flow_file" ] && continue

  # Extract flow_id from filename
  filename=$(basename "$flow_file")
  flow_id=$(echo "$filename" | sed 's/conversation_flow_//' | sed 's/\.json$//')
  full_flow_id="conversation_flow_${flow_id}"

  # Check if this flow has a parent agent
  agent_name="${FLOW_TO_AGENT[$full_flow_id]}"

  if [ -n "$agent_name" ]; then
    # Rename with agent prefix
    new_filename="${agent_name}_conversation_flow_${flow_id}.json"
    new_filepath="$FLOWS_DIR/$new_filename"

    echo "  $filename -> $new_filename"
    mv "$flow_file" "$new_filepath"
    ((renamed_count++))
  else
    # No parent agent, keep as is
    echo "  $filename (no parent agent, keeping as is)"
    ((skipped_count++))
  fi
done

echo ""
echo "=== Summary ==="
echo "Renamed: $renamed_count flows"
echo "Skipped: $skipped_count flows (no parent agent)"
echo "Total: $((renamed_count + skipped_count)) flows"

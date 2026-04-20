#!/bin/zsh

# Flatten flows and components to single files
# Flows: conversation_flow_{flow_id}.json
# Components: component_{component_id}.json

FLOWS_DIR="snapshots/flows"
COMPONENTS_DIR="snapshots/components"
FLOWS_INDEX="$FLOWS_DIR/index.json"
COMPONENTS_INDEX="$COMPONENTS_DIR/index.json"

echo "=== Flattening Flows ==="

# Process flows
if [ -f "$FLOWS_INDEX" ]; then
  jq -r 'to_entries[] | @json' "$FLOWS_INDEX" | while IFS= read -r entry; do
    flow_key=$(echo "$entry" | jq -r '.key')
    flow_id=${flow_key#conversation_flow_}
    current_version=$(echo "$entry" | jq -r '.value.current_version // 0')

    # New filename
    new_filename="conversation_flow_${flow_id}.json"

    # Find folder
    folder_name=$(ls -d "$FLOWS_DIR"/*/ 2>/dev/null | grep -i "$flow_id" | head -1)

    if [ -n "$folder_name" ]; then
      # Find latest version file
      latest_file=$(find "$folder_name" -name "v${current_version}_*.json" | head -1)

      if [ -n "$latest_file" ] && [ -f "$latest_file" ]; then
        echo "Flow: $flow_id v$current_version -> $new_filename"
        cp "$latest_file" "$FLOWS_DIR/$new_filename"
      else
        echo "Warning: Latest file not found for flow $flow_id (v$current_version)"
      fi
    else
      echo "Warning: Folder not found for flow $flow_id"
    fi
  done
fi

echo ""
echo "=== Flattening Components ==="

# Process components
if [ -f "$COMPONENTS_INDEX" ]; then
  jq -r 'to_entries[] | @json' "$COMPONENTS_INDEX" | while IFS= read -r entry; do
    component_key=$(echo "$entry" | jq -r '.key')
    component_id=${component_key#conversation_flow_component_}
    snapshots=$(echo "$entry" | jq -r '.value.snapshots // [] | length')

    # New filename
    new_filename="component_${component_id}.json"

    # Find folder
    folder_name=$(ls -d "$COMPONENTS_DIR"/*/ 2>/dev/null | grep -i "$component_id" | head -1)

    if [ -n "$folder_name" ]; then
      # Get latest snapshot (last in array)
      latest_file=$(ls -t "$folder_name"/*.json 2>/dev/null | head -1)

      if [ -n "$latest_file" ] && [ -f "$latest_file" ]; then
        echo "Component: $component_id -> $new_filename"
        cp "$latest_file" "$COMPONENTS_DIR/$new_filename"
      else
        echo "Warning: Latest file not found for component $component_id"
      fi
    else
      echo "Warning: Folder not found for component $component_id"
    fi
  done
fi

echo ""
echo "=== Cleanup old folders ==="
rm -rf "$FLOWS_DIR"/flow_*/ 2>/dev/null
rm -rf "$COMPONENTS_DIR"/*_component_*/ 2>/dev/null
echo "Folders removed"

echo ""
echo "=== Summary ==="
echo "Flows: $(ls -1 "$FLOWS_DIR"/conversation_flow_*.json 2>/dev/null | wc -l) files"
echo "Components: $(ls -1 "$COMPONENTS_DIR"/component_*.json 2>/dev/null | wc -l) files"

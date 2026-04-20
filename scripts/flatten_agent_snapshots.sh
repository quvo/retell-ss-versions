#!/bin/zsh

# agentsディレクトリをフォルダ構造からフラット構造に変換
# 最新版のみを {agent_name}_{agent_id}.json として保存

AGENTS_DIR="snapshots/agents"
INDEX_FILE="$AGENTS_DIR/index.json"

echo "Flattening agent snapshots to {agent_name}_{agent_id}.json format..."

# index.jsonから各agentの情報を取得
jq -r 'to_entries[] | @json' "$INDEX_FILE" | while IFS= read -r entry; do
  agent_key=$(echo "$entry" | jq -r '.key')
  agent_id=${agent_key#agent_}
  agent_name=$(echo "$entry" | jq -r '.value.agent_name')
  current_version=$(echo "$entry" | jq -r '.value.current_version')

  # agent_nameからファイル名用のsanitized nameを生成
  # スペース、スラッシュ、括弧などを適切に変換
  sanitized_name=$(echo "$agent_name" | sed 's/ /_/g' | sed 's/[\/()]/_/g' | sed 's/__*/_/g' | sed 's/^_//;s/_$//')

  # 新しいファイル名
  new_filename="${sanitized_name}_${agent_id}.json"

  # フォルダ構造から最新版のファイルを探す
  folder_name=$(ls -d "$AGENTS_DIR"/*/ 2>/dev/null | grep -i "$agent_id" | head -1)

  if [ -n "$folder_name" ]; then
    # フォルダ内の最新版ファイルを探す
    latest_file=$(find "$folder_name" -name "*v${current_version}_*.json" | head -1)

    if [ -n "$latest_file" ] && [ -f "$latest_file" ]; then
      echo "Processing: $agent_name (v$current_version)"
      echo "  From: $latest_file"
      echo "  To: $AGENTS_DIR/$new_filename"
      cp "$latest_file" "$AGENTS_DIR/$new_filename"
    else
      echo "Warning: Latest file not found for $agent_name (v$current_version)"
    fi
  else
    echo "Warning: Folder not found for agent $agent_id"
  fi
done

echo ""
echo "Flattening complete!"
echo "Current structure:"
ls -1 "$AGENTS_DIR"/*.json 2>/dev/null | grep -v "index.json" | xargs -n1 basename | head -10
echo "..."
echo "Total: $(ls -1 "$AGENTS_DIR"/*.json 2>/dev/null | grep -v "index.json" | wc -l) agent files"

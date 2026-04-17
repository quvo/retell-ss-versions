# Conversation Flow を v4 にロールバックする方法

## 最も簡単な方法：Retell Dashboard を使用

1. **Retell Dashboard にアクセス**
   - https://dashboard.retellai.com/ にログイン

2. **Conversation Flows に移動**
   - 左メニューから "Conversation Flows" を選択

3. **該当フローを開く**
   - Flow ID: `conversation_flow_b17e58a95e61` を検索して開く

4. **Version History を確認**
   - 右上または設定エリアに "Version History" または "Versions" ボタンがあるはず
   - クリックして過去のバージョン一覧を表示

5. **Version 4 を選択**
   - Version 4 の行を見つける
   - "Restore" または "Revert to this version" ボタンをクリック

6. **確認**
   - 新しいバージョン（v6）として v4 の内容が復元される
   - Agent設定でこの新しいバージョンを使用するように更新

---

## 代替方法：API経由での対応（手動）

Dashboard でロールバックできない場合：

### オプション A: 共有コンポーネントを削除して再作成

v4 と v5 の違いは、9個のコンポーネントが shared → local に変わっただけです。

#### 影響を受けるノード:
- `component-node-1773270300977` - Callback Promise
- `component-node-1773270881440` - End Call  
- `component-node-1773796973010` - Callback Promise
- `component-node-1773797147838` - End Call
- `component-node-1773797432815` - Callback Promise
- `component-node-1773797438614` - End Call
- `component-node-1773805333020` - End Call
- `component-node-1773805339157` - Callback Promise
- `component-node-tth-callback-promise` - Callback Promise

#### 手順:
1. これらのノードを削除
2. 同じ位置に conversation ノードまたは新しいローカルコンポーネントを作成
3. エッジ（遷移）を再接続

### オプション B: 新しいフローとして v4 を再作成

1. v4 をダウンロード（既に `conversation_flow_v4.json` にある）
2. 新しい conversation flow として作成
3. Agent の設定を新しいフローに変更

---

## 推奨：Dashboard での操作

**一番安全で簡単な方法は Retell Dashboard を使うことです。**

API経由でのロールバックは、コンポーネントID の互換性問題があり複雑です。

---

## バックアップ

現在のバージョンは以下にバックアップ済み：
- `conversation_flow_v4.json` - Version 4
- `conversation_flow_v5.json` - Version 5

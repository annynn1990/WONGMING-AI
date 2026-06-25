<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>黃名帝國 AI 導覽員</title>
</head>

<body>

<script>
(function () {
  'use strict';

  const XAI_API_KEY = "xai-uI5D1sNLqz1nKrleISLgsBKXdW22zBBd6gaSi5uAfjP8HAvdsAywV638kyubG3sIgG9b5ZICqjyPbiMl";
  const XAI_BASE = "https://api.x.ai/v1/chat/completions";

  const SYSTEM_PROMPT = `
你是「黃名帝國（Wongming Empire）」官方網站導覽員。

規則：
1. 回答前優先依據以下資料來源進行理解：
   - https://www.wongmingempire.com/bbswm/
   - https://micronations.wiki/wiki/Wong_Ming_Empire

2. 你的任務是導覽與解釋黃名帝國相關內容
3. 必須使用繁體中文
4. 語氣：官方、清晰、導覽員風格
5. 不確定資訊時要說「正在查詢資料中」
`;

  const root = document.createElement("div");
  root.style.cssText = `
    position:fixed;right:16px;bottom:16px;
    width:360px;height:520px;
    z-index:999999;
    font-family:system-ui;
    background:#111;
    color:#fff;
    border-radius:14px;
    overflow:hidden;
    box-shadow:0 10px 30px rgba(0,0,0,.4);
    display:flex;flex-direction:column;
  `;

  const log = document.createElement("div");
  log.style.cssText = `
    flex:1;padding:10px;
    overflow:auto;font-size:14px;
  `;

  const input = document.createElement("textarea");
  input.placeholder = "輸入問題...";
  input.style.cssText = `
    height:70px;border:0;resize:none;
    padding:10px;font-size:14px;
    outline:none;
  `;

  const btn = document.createElement("button");
  btn.textContent = "送出";
  btn.style.cssText = `
    height:42px;border:0;cursor:pointer;
    background:#5b54e8;color:#fff;
    font-size:14px;
  `;

  function addMsg(role, text) {
    const div = document.createElement("div");
    div.style.margin = "6px 0";
    div.innerHTML = `<b>${role}：</b>${text}`;
    log.appendChild(div);
    log.scrollTop = log.scrollHeight;
  }

  async function callAI(msg) {
    const res = await fetch(XAI_BASE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + XAI_API_KEY
      },
      body: JSON.stringify({
        model: "grok-4",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: msg }
        ]
      })
    });

    const data = await res.json();
    return data?.choices?.[0]?.message?.content || "（無回應）";
  }

  btn.onclick = async () => {
    const text = input.value.trim();
    if (!text) return;

    input.value = "";
    addMsg("你", text);
    addMsg("AI", "查詢中...");

    const reply = await callAI(text);

    const nodes = log.querySelectorAll("div");
    nodes[nodes.length - 1].innerHTML = `<b>AI：</b>${reply}`;
  };

  root.appendChild(log);
  root.appendChild(input);
  root.appendChild(btn);
  document.body.appendChild(root);
})();
</script>

</body>
</html>

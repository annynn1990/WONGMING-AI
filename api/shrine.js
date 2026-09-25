const REPO = "annynn1990/WONGMING-AI";
const BRANCH = "main";
const PATH = "data/shrine-lamps.json";
const GH = "https://api.github.com";

function headers() {
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28"
  };
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function getFile() {
  const r = await fetch(`${GH}/repos/${REPO}/contents/${PATH}?ref=${BRANCH}`, { headers: headers() });
  if (!r.ok) throw new Error(`讀取資料失敗：${r.status}`);
  return r.json();
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).end();

  if (!process.env.GITHUB_TOKEN) {
    return res.status(500).json({ ok: false, message: "服務尚未完成設定" });
  }

  try {
    if (req.method === "GET") {
      const file = await getFile();
      const data = JSON.parse(Buffer.from(file.content, "base64").toString("utf8"));
      return res.status(200).json(data);
    }

    if (req.method === "POST") {
      let data = req.body;
      if (typeof data === "string") data = JSON.parse(data);
      if (!Array.isArray(data) || data.length !== 80) {
        return res.status(400).json({ ok: false, message: "資料格式錯誤" });
      }

      const file = await getFile();
      const content = Buffer.from(JSON.stringify(data, null, 2) + "\n").toString("base64");

      const r = await fetch(`${GH}/repos/${REPO}/contents/${PATH}`, {
        method: "PUT",
        headers: headers(),
        body: JSON.stringify({
          message: "更新燈牆資料",
          content,
          sha: file.sha,
          branch: BRANCH
        })
      });

      if (!r.ok) {
        const detail = await r.text();
        console.error("GitHub write failed", r.status, detail);
        return res.status(502).json({ ok: false, message: "資料儲存失敗" });
      }

      return res.status(200).json({ ok: true });
    }

    res.setHeader("Allow", "GET,POST,OPTIONS");
    return res.status(405).json({ ok: false, message: "不支援的操作" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, message: "同步服務發生錯誤" });
  }
}

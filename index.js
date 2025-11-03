import { chromium } from "playwright";
import express from "express";
import { execSync } from "child_process";

const app = express();
app.use(express.json());

// ✅ Ensure Chromium installed
try {
  console.log("Installing Playwright Chromium...");
  execSync("npx playwright install chromium", { stdio: "inherit" });
  console.log("Chromium install completed ✅");
} catch (err) {
  console.error("Playwright install failed:", err.message);
}

app.post("/capture", async (req, res) => {
  const { url, caseNumber } = req.body;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const request = context.request;

    console.log(`Fetching: ${url}`);
    const response = await request.get(url);

    if (!response.ok()) {
      throw new Error(`HTTP ${response.status()} - ${response.statusText()}`);
    }

    const buffer = await response.body();
    const contentType = response.headers()["content-type"] || "application/octet-stream";
    const filename = `${caseNumber || "ecf"}_${Date.now()}.pdf`;

    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    res.setHeader("Content-Type", contentType);
    res.status(200).send(buffer);
  } catch (err) {
    console.error("Capture failed:", err.message);
    res.status(500).json({ error: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

app.get("/", (_, res) => res.send("✅ ECF Capture Worker is running"));
app.listen(3000, () => console.log("Listening on port 3000"));




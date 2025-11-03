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

// ✅ Capture route
app.post("/capture", async (req, res) => {
  const { url, caseNumber } = req.body;
  if (!url) return res.status(400).json({ error: "Missing URL" });

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    console.log(`Fetching: ${url}`);
    const response = await page.goto(url, { waitUntil: "networkidle" });

    let buffer;
    let contentType = response?.headers()?.["content-type"] || "";

    try {
      // Try reading raw body first (works for PDFs)
      buffer = await response.body();
    } catch (err) {
      // Fallback: page changed context (HTML login redirect, token expired, etc.)
      console.warn("Primary body fetch failed, falling back to page content...");
      const html = await page.content();
      buffer = Buffer.from(html, "utf8");
      contentType = "text/html; charset=utf-8";
    }

    const filename = `${caseNumber || "ecf"}_${Date.now()}.${contentType.includes("pdf") ? "pdf" : "html"}`;

    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    res.setHeader("Content-Type", contentType);
    res.status(200).send(buffer);
  } catch (err) {
    console.error("Capture failed:", err.message);
    // Send readable failure message instead of 500
    res.status(200).json({ success: false, error: "Unopenable or expired link", detail: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

app.get("/", (_, res) => res.send("✅ ECF Capture Worker is running"));
app.listen(3000, () => console.log("Listening on port 3000"));





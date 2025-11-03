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
  if (!url) return res.status(400).json({ success: false, error: "Missing URL" });

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    console.log(`Fetching: ${url}`);
    const response = await page.goto(url, { waitUntil: "networkidle" });

    let contentType = response?.headers()?.["content-type"] || "";
    let buffer;

    // Try to read body
    try {
      buffer = await response.body();
    } catch {
      console.warn("Primary body fetch failed, falling back to page content...");
      const html = await page.content();
      buffer = Buffer.from(html, "utf8");
      contentType = "text/html; charset=utf-8";
    }

    // If it's HTML, look for iframe src (the real PDF)
    if (contentType.includes("html")) {
      const html = buffer.toString();
      const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);

      if (iframeMatch) {
        const iframeUrl = new URL(iframeMatch[1], url).href;
        console.log("Found PDF iframe:", iframeUrl);

        const pdfResp = await page.request.get(iframeUrl);
        if (pdfResp.ok()) {
          const pdfBuffer = await pdfResp.body();
          res.setHeader("Content-Type", "application/pdf");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename=${caseNumber || "ecf"}_${Date.now()}.pdf`
          );
          return res.status(200).send(pdfBuffer);
        }
      }
    }

    // If PDF already
    if (contentType.includes("pdf") || buffer.slice(0, 4).toString() === "%PDF") {
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=${caseNumber || "ecf"}_${Date.now()}.pdf`
      );
      return res.status(200).send(buffer);
    }

    // Otherwise return structured JSON for redirects or login pages
    const htmlSnippet = buffer.toString().slice(0, 400);
    return res.status(200).json({
      success: false,
      status: "expired_or_redirect",
      message: "Document already opened or expired",
      preview: htmlSnippet
    });
  } catch (err) {
    console.error("Capture failed:", err.message);
    return res.status(200).json({
      success: false,
      status: "error",
      message: "Unopenable or expired link",
      detail: err.message
    });
  } finally {
    if (browser) await browser.close();
  }
});

app.get("/", (_, res) => res.send("✅ ECF Capture Worker is running"));
app.listen(3000, () => console.log("Listening on port 3000"));





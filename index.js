import { chromium } from "playwright";
import express from "express";

const app = express();
app.use(express.json());

app.post("/capture", async (req, res) => {
  const { url, caseNumber } = req.body;

  if (!url) {
    return res.status(400).json({ error: "Missing URL" });
  }

  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    const response = await page.goto(url, { waitUntil: "networkidle" });
    const buffer = await response.body();
    await browser.close();

    const filename = `${caseNumber || "ecf"}_${Date.now()}.pdf`;

    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    res.setHeader("Content-Type", "application/pdf");
    res.status(200).send(buffer);
  } catch (err) {
    console.error("Capture failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (_, res) => res.send("✅ ECF Capture Worker is running"));
app.listen(3000, () => console.log("Listening on port 3000"));

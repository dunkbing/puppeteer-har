import express from "express";
import crypto from 'crypto';
import { launch } from "puppeteer";
import { createRunner, PuppeteerRunnerExtension } from "@puppeteer/replay";
import fs from "fs";
import { readFile } from 'fs/promises'
import path from "path";
import lighthouse from 'lighthouse';

import { wait, stringToSlug } from "./lib/utils.js";
import PuppeteerHar from "./lib/PuppeteerHar.js";

const ua =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
const headers = { 'user-agent': ua };

const app = express();
app.use(express.json());

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }
  res.status(500);
  res.render("error", { error: err });
}
app.use(errorHandler);

async function runHar(browser, data) {
  console.log("exporting har")
  const title = data.steps?.title || crypto.randomUUID();
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(0);
  page.setExtraHTTPHeaders(headers);
  const har = new PuppeteerHar(page);
  const filename = `${stringToSlug(title)}.har`
  const outputFile = path.join("har", filename);
  if (!fs.existsSync("har")) {
    fs.mkdirSync("har");
  }
  if (fs.existsSync(outputFile)) {
    fs.unlinkSync(outputFile);
  }
  await har.start({ path: outputFile });

  if (Object.keys(data.steps).length) {
    const runner = await createRunner(
      data.steps,
      new PuppeteerRunnerExtension(browser, page, { timeout: 60000 }),
    );
    await runner.run();
  }
  else {
    await page.goto(data.url)
  }

  await wait(1000);
  await har.stop();
  await page.close();

  const stats = fs.statSync(outputFile);
  const size = stats.size;
  return { file: filename, size };
}

async function runLh(browser, url) {
  console.log("running lighthouse for:", url)
  const page = await browser.newPage();
  page.setExtraHTTPHeaders(headers);
  const { lhr } = await lighthouse(url, undefined, undefined, page);
  const overallScore = Object.entries(lhr.categories).reduce((acc, [k, v]) => {
    acc[k] = v.score;
    return acc;
  }, {})

  const { audits } = lhr;
  const firstContentFulPaint = audits['first-contentful-paint'].numericValue;
  const largestContentFulPaint = audits['largest-contentful-paint'].numericValue;
  const serverResponseTime = audits['server-response-time'].numericValue;
  const timeToInteractive = audits['interactive'].numericValue;
  const speedIndex = audits['speed-index'].numericValue;

  void page.close();

  return { firstContentFulPaint, largestContentFulPaint, serverResponseTime, timeToInteractive, speedIndex, overallScore }
}

app.post("/run", async (req, res) => {
  const body = req.body;
  const browser = await launch({ args: ["--no-sandbox"], headless: true });

  const [{ size, file }, lh] = await Promise.all([runHar(browser, body), runLh(browser, body.url)])

  void browser.close();

  res.json({
    size: `${size} bytes`,
    file,
    lh
  });
});

app.get('/har/:name', async (req, res) => {
  const filename = req.params.name
  const filepath = path.join(import.meta.dirname, 'har', filename)
  if (!fs.existsSync(filepath)) {
    return res.status(500).json({ error: "file not found" })
  }
  const data = await readFile(filepath)
  return res.json(JSON.parse(data))
})

app.get("/ua", async (req, res) => {
  const browser = await launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage();

  // Navigate the page to target website
  await page.goto("https://httpbin.io/user-agent");

  // Get the text content of the page's body
  const content = await page.evaluate(() => document.body.textContent);

  // Log the text content
  console.log("Content: ", content);

  // Close the browser
  await browser.close();

  res.json({ ua: content });
});

const port = process.env.PORT || 3000;

const server = app.listen(port, async () => {
  console.log(`Server listening on port ${port}`);
});

const signals = {
  SIGHUP: 1,
  SIGINT: 2,
  SIGTERM: 15,
};
// Do any necessary shutdown logic for our application here
const shutdown = (signal, value) => {
  console.log("shutdown!");
  server.close(() => {
    console.log(`server stopped by ${signal} with value ${value}`);
    process.exit(128 + value);
  });
};
// Create a listener for each of the signals that we want to handle
Object.keys(signals).forEach((signal) => {
  process.on(signal, () => {
    console.log(`process received a ${signal} signal`);
    shutdown(signal, signals[signal]);
  });
});

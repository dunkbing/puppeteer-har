import { launch } from 'puppeteer'
import { createRunner, PuppeteerRunnerExtension } from '@puppeteer/replay'
import crypto from 'crypto'
import path from 'path'
import fs from 'fs'
import url from 'url'
import lighthouse from 'lighthouse'

import { wait, stringToSlug } from './lib/utils.js'
import PuppeteerHar from './lib/PuppeteerHar.js'

const ua =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
const headers = { 'user-agent': ua }

const __dirname = url.fileURLToPath(new URL('.', import.meta.url))
// const __filename = url.fileURLToPath(import.meta.url);

export const harDir = path.join(__dirname, 'har')
if (!fs.existsSync(harDir)) {
  fs.mkdirSync(harDir)
}

export async function openBrowser () {
  const browser = await launch({ args: ['--no-sandbox'], headless: true })
  return browser
}

/**
 * @param {import('puppeteer').Browser} browser
 */
export async function runHar (browser, data) {
  console.time('export har')
  const title = data.steps?.title || crypto.randomUUID()
  const page = await browser.newPage()
  page.setDefaultNavigationTimeout(0)
  page.setExtraHTTPHeaders(headers)
  const har = new PuppeteerHar(page)
  const filename = `${stringToSlug(title)}.har`
  const outputFile = path.join(harDir, filename)

  if (fs.existsSync(outputFile)) {
    fs.unlinkSync(outputFile)
  }
  await har.start({ path: outputFile })

  if (Object.keys(data.steps).length) {
    const runner = await createRunner(
      data.steps,
      new PuppeteerRunnerExtension(browser, page, { timeout: 60000 })
    )
    await runner.run()
  } else {
    await page.goto(data.url)
  }

  await wait(1000)
  await har.stop()
  await page.close()

  const stats = fs.statSync(outputFile)
  const size = stats.size
  console.timeEnd('export har')
  return { file: filename, size }
}

export async function runLh (browser, url) {
  const logKey = `run lighthouse for: ${url}`
  console.time(logKey)
  const page = await browser.newPage()
  page.setExtraHTTPHeaders(headers)
  const { lhr } = await lighthouse(url, undefined, undefined, page)
  const overallScore = Object.entries(lhr.categories).reduce((acc, [k, v]) => {
    acc[k] = v.score
    return acc
  }, {})

  const { audits } = lhr
  const firstContentfulPaint = audits['first-contentful-paint'].numericValue
  const largestContentfulPaint =
    audits['largest-contentful-paint'].numericValue
  const serverResponseTime = audits['server-response-time'].numericValue
  const timeToInteractive = audits.interactive.numericValue
  const speedIndex = audits['speed-index'].numericValue

  await page.close()
  console.timeEnd(logKey)

  return {
    firstContentfulPaint,
    largestContentfulPaint,
    serverResponseTime,
    timeToInteractive,
    speedIndex,
    overallScore
  }
}

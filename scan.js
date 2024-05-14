import { launch } from 'puppeteer'
import { createRunner, PuppeteerRunnerExtension } from '@puppeteer/replay'
import crypto from 'crypto'
import path from 'path'
import fs from 'fs'
import url from 'url'
import lighthouse from 'lighthouse'
import desktopConfig from 'lighthouse/core/config/desktop-config.js'

import { stringToSlug } from './lib/utils.js'
import PuppeteerHar from './lib/PuppeteerHar.js'

const ua =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
const headers = { 'user-agent': ua }

const __dirname = url.fileURLToPath(new URL('.', import.meta.url))
// const __filename = url.fileURLToPath(import.meta.url);

const timeout = 60000

export const harDir = path.join(__dirname, 'har')
if (!fs.existsSync(harDir)) {
  fs.mkdirSync(harDir)
}

export async function openBrowser (overwriteHost) {
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--start-maximized',
    '--lang=en-US',
    '--disable-infobars',
    '--disable-blink-features=AutomationControlled',
    '--disable-dev-shm-usage',
    '--disable-extensions',
    '--disable-gpu',
    '--disable-audio'
  ]
  if (overwriteHost) {
    console.log('overwrite host', overwriteHost)
    // args.push('--host-resolver-rules=MAP google.com 127.0.0.1')
    args.push(`--host-resolver-rules=MAP ${overwriteHost}`)
  }
  const browser = await launch({
    defaultViewport: null,
    args,
    headless: true
  })
  return browser
}

/**
 * @param {import('puppeteer').Browser} browser
 */
export async function runHar (browser, data) {
  let page
  let timeoutId
  try {
    const title = data.steps?.title || crypto.randomUUID()
    page = await browser.newPage()
    page.setDefaultNavigationTimeout(timeout)
    page.setExtraHTTPHeaders(headers)
    page.setViewport({ width: 0, height: 0 })
    const har = new PuppeteerHar(page)
    const filename = `${stringToSlug(title)}.har`
    const outputFile = path.join(harDir, filename)

    if (fs.existsSync(outputFile)) {
      fs.unlinkSync(outputFile)
    }
    await har.start({ path: outputFile })

    timeoutId = setTimeout(async () => {
      console.log('exceeded timeout', data.url)
      await har.stop()
      await page.close()
    }, timeout - 3000)

    if (data.steps && Object.keys(data.steps).length) {
      await createRunner(data.steps, new PuppeteerRunnerExtension(browser, page, { timeout }))
        .then(async (runner) => {
          try {
            return await runner.run()
          } catch (err) {
            return console.log('run steps error', err)
          }
        })
        .catch((err) => {
          console.log('create runner error', err)
        })
    } else {
      await page.goto(data.url)
    }

    await har.stop()
    await page.close()

    const stats = fs.statSync(outputFile)
    const size = stats.size
    return [{ file: filename, size }, null]
  } catch (err) {
    return [null, err]
  } finally {
    clearTimeout(timeoutId)
    if (!page?.isClosed()) page?.close()
  }
}

export async function runLh (browser, url) {
  try {
    const page = await browser.newPage()
    page.setDefaultNavigationTimeout(timeout)
    page.setExtraHTTPHeaders(headers)
    page.setViewport({ width: 0, height: 0 })
    const { lhr } = await lighthouse(url, undefined, desktopConfig, page)
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

    return [{
      firstContentfulPaint,
      largestContentfulPaint,
      serverResponseTime,
      timeToInteractive,
      speedIndex,
      overallScore
    }, null]
  } catch (err) {
    return [null, err]
  }
}

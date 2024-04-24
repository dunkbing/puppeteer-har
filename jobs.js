import { parentPort, threadId } from 'worker_threads'
import path from 'path'
import fs from 'fs'
import { readFile } from 'fs/promises'
import { Worker } from 'bullmq'

import { config } from './config.js'
import { cred, publisher } from './pubsub.js'
import { openBrowser, runHar, runLh, harDir } from './scan.js'

const worker = new Worker('scan-job', async (job) => {
  if (job.name !== 'start-monitoring') return

  const steps = job.data
  const { agentId, scanId, url } = steps
  const label = `thread-${threadId} scan-for ${scanId} ${url}`
  console.log(label)

  let browser
  try {
    console.time(label)
    if (agentId !== config.agentId) {
      return
    }

    browser = await openBrowser()
    let res = { id: scanId }
    const [har, lh] = await Promise.allSettled([
      runHar(browser, steps),
      runLh(browser, url)
    ])
    if (lh.status === 'fulfilled') {
      res = { ...res, ...lh.value }
    }
    if (har.status === 'fulfilled') {
      const { file } = har.value
      const filepath = path.join(harDir, file)
      if (!fs.existsSync(filepath)) {
        console.log('file not found', filepath)
      } else {
        const data = await readFile(filepath, { encoding: 'utf-8' })
        res = { ...res, har: JSON.parse(data) }
      }
    }

    publisher.publish(
      'scan-result',
      JSON.stringify(res)
    )

    await browser.close()
    console.timeEnd(label)
    parentPort.postMessage(`thread_id: ${threadId} done`)
  } catch (e) {
    console.log('job error', url, scanId, e)
    browser?.close()
  }
}, { connection: cred })

worker.on('error', (err) => {
  console.log(`worker ${threadId} error`, err)
})

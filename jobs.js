import { parentPort, threadId } from 'node:worker_threads'
import path from 'path'
import fs from 'fs'
import { readFile } from 'fs/promises'
import { Worker } from 'bullmq'

import { config, taskQueueName } from './config.js'
import { cred, publisher } from './pubsub.js'
import { openBrowser, runHar, runLh, harDir } from './scan.js'
import { calculateFinishTime } from './calculate_finished_time.js'

console.log('worker', threadId, 'spawned')

const worker = new Worker(taskQueueName, async (job) => {
  const jobName = `start-monitoring-${config.agentId}`
  if (job.name !== jobName) {
    console.warn('invalid job name', job.name, jobName)
    return
  }

  const steps = job.data
  const { scanId, url } = steps
  const label = `thread-${threadId} scan-for ${scanId} ${url}`
  console.log(label)

  let browser
  try {
    console.time(label)

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
        const har = JSON.parse(data)
        const finishTime = calculateFinishTime(har.log.entries)
        res = { ...res, finishTime, har }
      }
    }

    publisher.publish(
      'scan-result',
      JSON.stringify(res)
    )

    await browser.close()
    parentPort.postMessage(`thread_id: ${threadId} done`)
  } catch (e) {
    console.log('job error', url, scanId, e)
    browser?.close()
  } finally {
    console.timeEnd(label)
  }
}, { connection: cred })

worker.on('error', (err) => {
  console.log(`worker ${threadId} error`, err)
})

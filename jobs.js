import { parentPort, threadId } from 'node:worker_threads'
import path from 'path'
import fs from 'fs'
import { readFile } from 'fs/promises'
import { Worker } from 'bullmq'

import { config, taskQueueName } from './config.js'
import { cred, publisher } from './pubsub.js'
import { harDir, openBrowser, runHar, runLh } from './scan.js'
import { calculateFinishTime } from './calculate_finished_time.js'
import { isValidHttpUrl, wait } from './lib/utils.js'

console.log('worker', threadId, 'spawned')

const worker = new Worker(taskQueueName, async (job) => {
  const jobName = `start-monitoring-${config.agentId}`
  if (job.name !== jobName) {
    console.warn('invalid job name', job.name, jobName)
    return
  }

  const steps = job.data
  const { scanId, url, overwriteHost } = steps
  if (!isValidHttpUrl(url)) {
    console.log('Invalid url', url)
    return
  }
  const label = `${new Date().toString()}-thread-${threadId} scan-for ${scanId} ${url}`
  console.log(label)

  let browser
  try {
    console.time(label)
    if (overwriteHost) {
      const { hostname } = new URL(url)
      browser = await openBrowser(`${hostname} ${overwriteHost}`)
    } else {
      browser = await openBrowser()
    }
    let res = { id: scanId }

    const [har, harErr] = await runHar(browser, steps)
    if (harErr) {
      console.error('Error running har', harErr)
    } else {
      const { file } = har
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
    const [lh, lhErr] = await runLh(browser, url)
    if (lhErr) {
      console.error('Error running lh', lhErr)
    } else {
      res = { ...res, ...lh }
    }
    await browser.close()

    publisher.publish(
      'scan-result',
      JSON.stringify(res)
    )

    parentPort.postMessage(`thread_id: ${threadId} done`)
  } catch (e) {
    console.log('job error', url, scanId, e)
  } finally {
    console.timeEnd(label)
    await wait(5000)
    browser?.close()
  }
}, { connection: cred })

worker.on('error', (err) => {
  console.log(`worker ${threadId} error`, err)
})

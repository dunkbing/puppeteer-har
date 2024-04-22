import path from 'path'
import fs from 'fs'
import { readFile } from 'fs/promises'

import { config } from './config.js'
import { connectAll, publisher, subscriber } from './pubsub.js'
import { openBrowser, runHar, runLh, harDir } from './scan.js'
import { wait } from './lib/utils.js'

const queue = []
const processingTask = { value: false }

export async function startJobs () {
  await connectAll()
  console.log('Starting jobs')
  subscriber.subscribe('start', (err, count) => {
    if (err) {
      // ex network issues.
      console.error('Failed to subscribe: %s', err.message)
    } else {
      console.log(
        `Subscribed successfully! This client is currently subscribed to ${count} channels.`
      )
    }
  })

  subscriber.on('message', async (channel, message) => {
    if (channel === 'start') {
      const steps = JSON.parse(message)
      queue.push(steps)
    }
  })

  setInterval(async () => {
    if (!queue.length || processingTask.value) {
      return
    }
    const steps = queue.pop()
    processingTask.value = true
    const { agentId, scanId, url } = steps
    const label = `scan-for-${scanId}`
    console.log(label)
    console.time(label)
    if (agentId !== config.agentId) {
      return
    }

    const browser = await openBrowser()
    const [{ file }, lh] = await Promise.all([
      runHar(browser, steps),
      runLh(browser, url)
    ])
    const filepath = path.join(harDir, file)
    if (!fs.existsSync(filepath)) {
      console.log('file not found', filepath)
    }
    const data = await readFile(filepath, { encoding: 'utf-8' })
    publisher.publish(
      'scan-result',
      JSON.stringify({ id: scanId, ...lh, har: JSON.parse(data) })
    )

    await browser.close()
    processingTask.value = false
    console.timeEnd(label)
    await wait(1500)
  }, 2000)
}

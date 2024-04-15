import path from 'path'
import fs from 'fs'
import { readFile } from 'fs/promises'

import { config } from './config.js'
import { publisher, subscriber } from './pubsub.js'
import { openBrowser, runHar, runLh, harDir } from './scan.js'

export async function startJobs () {
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
    console.log(channel)
    if (channel === 'start') {
      const steps = JSON.parse(message)
      const { agentIds = [], scanId, url } = steps
      if (!agentIds.includes(config.agentId)) {
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

      void browser.close()
    }
  })
}

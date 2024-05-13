import { Worker } from 'node:worker_threads'
import { Queue } from 'bullmq'

import { config, taskQueueName } from './config.js'
import { connectAll, cred, subscriber } from './pubsub.js'

const currentThreads = {}

const taskQueue = new Queue(taskQueueName, { connection: cred })

async function startJobs () {
  await connectAll()
  console.log('Starting jobs')
  subscriber.subscribe('start', (err, count) => {
    if (err) {
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
      const { agentId } = steps
      if (config.agentId !== agentId) {
        return
      }
      taskQueue.add(`start-monitoring-${config.agentId}`, steps, {
        removeOnComplete: true,
        removeOnFail: true
      })
    }
  })
}

const runService = () => {
  const worker = new Worker('./jobs.js', {
    resourceLimits: { maxOldGenerationSizeMb: config.threadMemoryLimit }
  })
  console.log('spawning new worker', worker.threadId)
  currentThreads[worker.threadId] = worker

  worker.on('message', (val) => {
    console.log('message', val)
  })
  worker.on('error', (err) => {
    console.log('worker error', worker.threadId, err)
  })
  worker.on('exit', (code) => {
    if (code !== 0) {
      console.log(`worker ${worker.threadId} stopped with ${code} exit code`)
    }
  })
}

const run = async () => {
  startJobs()
  setInterval(() => {
    const keys = Object.keys(currentThreads)
    for (const k of keys) {
      if (currentThreads[k].threadId <= 0) {
        delete currentThreads[k]
      }
    }
    const currentThreadsNum = Object.keys(currentThreads).length
    if (currentThreadsNum < config.threadsNum) {
      runService()
    }
  }, 2000)
}

run()

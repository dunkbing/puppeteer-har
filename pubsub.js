import Redis from 'ioredis'

import { config } from './config.js'

const cred = {
  host: config.redisHost,
  port: config.redisPort,
  username: config.redisUser,
  password: config.redisPw,
  db: 0
}

export const publisher = new Redis(cred)

publisher.on('connect', () => console.log('Publisher connected'))

export const subscriber = new Redis(cred)

subscriber.on('connect', () => console.log('Subscriber connected'))

export function closeAll () {
  publisher.disconnect()
  subscriber.disconnect()
}

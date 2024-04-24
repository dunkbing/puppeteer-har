export const config = {
  nodeEnv: process.env.NODE_ENV,
  threadsNum: Number(process.env.THREADS_NUM || 2),
  agentId: process.env.AGENT_ID,
  redisHost: process.env.REDIS_HOST,
  redisPort: Number(process.env.REDIS_PORT),
  redisUser: process.env.REDIS_USER,
  redisPw: process.env.REDIS_PW
}

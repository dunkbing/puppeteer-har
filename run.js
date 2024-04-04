import { createRunner } from '@puppeteer/replay'

export async function run (steps, extension) {
  const runner = await createRunner(steps, extension)

  await runner.runBeforeAllSteps()

  await runner.run()

  await runner.runAfterAllSteps()
}

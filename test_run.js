import { createRunner } from '@puppeteer/replay'

export async function run (extension) {
  const runner = await createRunner(extension)

  await runner.runBeforeAllSteps()

  await runner.runStep({
    type: 'setViewport',
    width: 1023,
    height: 1043,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    isLandscape: false
  })
  await runner.runStep({
    type: 'navigate',
    url: 'https://stackoverflow.com/questions/7172784/how-do-i-post-json-data-with-curl',
    assertedEvents: [
      {
        type: 'navigation',
        url: 'https://stackoverflow.com/questions/7172784/how-do-i-post-json-data-with-curl',
        title: 'rest - How do I POST JSON data with cURL? - Stack Overflow'
      }
    ]
  })
  await runner.runStep({
    type: 'doubleClick',
    target: 'main',
    selectors: [
      [
        '#answer-7173011 pre.lang-bash > code'
      ],
      [
        'xpath///*[@id="answer-7173011"]/div/div[2]/div[1]/pre[2]/code'
      ],
      [
        'pierce/#answer-7173011 pre.lang-bash > code'
      ]
    ],
    offsetY: 17.9296875,
    offsetX: 112.25
  })

  await runner.runAfterAllSteps()
}

run()

export async function autoScroll (page) {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        let scrollTop = -1
        const interval = setInterval(() => {
          window.scrollBy(0, 200)
          if (document.documentElement.scrollTop !== scrollTop) {
            scrollTop = document.documentElement.scrollTop
            return
          }
          clearInterval(interval)
          resolve()
        }, 200)
      })
  )
}

export function wait (ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

export function stringToSlug (inputString) {
  // Normalize the string: convert to lowercase and trim
  const normalizedString = inputString.toLowerCase().trim()

  // Replace spaces, special characters, and forward slashes with dashes
  const slug = normalizedString.replace(/[\s/]+/g, '-')

  return slug
}

export function isValidHttpUrl (str) {
  let url_

  try {
    url_ = new URL(str)
  } catch (_) {
    return false
  }

  return url_.protocol === 'http:' || url_.protocol === 'https:'
}

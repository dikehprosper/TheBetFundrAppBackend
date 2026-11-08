/** fetch with a hard timeout, so a hung provider can never hang a request forever. */
async function fetchWithTimeout (url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

module.exports = { fetchWithTimeout }

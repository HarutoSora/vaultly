import type { BackgroundRequest, BackgroundResponse } from '../messages'

export function send<T>(message: BackgroundRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response: BackgroundResponse<T>) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }
      if (response.ok) resolve(response.data)
      else reject(new Error(response.error))
    })
  })
}

export async function getActiveTabOrigin(): Promise<string | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.url) return null
  try {
    return new URL(tab.url).origin
  } catch {
    return null
  }
}

export async function getActiveTabId(): Promise<number | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab?.id ?? null
}

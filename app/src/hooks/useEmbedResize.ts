'use client'

import { useEffect, useRef } from 'react'

/** Message type the game posts to the parent when embedded so the top frame can resize the iframe. */
export const EMBED_RESIZE_MESSAGE_TYPE = 'chainreaction-embed-resize' as const

export interface EmbedResizeMessage {
  type: typeof EMBED_RESIZE_MESSAGE_TYPE
  width: number
  height: number
}

/** Minimum height sent on route change so the iframe shrinks immediately; then we send the real height after layout. */
const EMBED_RESIZE_MIN_HEIGHT = 320

function isEmbedded(): boolean {
  return typeof window !== 'undefined' && window.self !== window.top
}

function sendResize(width: number, height: number) {
  try {
    const msg: EmbedResizeMessage = { type: EMBED_RESIZE_MESSAGE_TYPE, width, height }
    window.parent.postMessage(msg, '*')
  } catch {
    // cross-origin or closed parent
  }
}

/**
 * When the game is in an iframe:
 * - Sets data-embedded="true" on <html> so CSS can hide scrollbars.
 * - Observes body size and posts { type: 'chainreaction-embed-resize', width, height } to the parent
 *   so the top frame can set the iframe dimensions.
 * @param reportWhen - Optional; when this value changes, a resize is reported again (e.g. pass isLoading so height is sent after async content loads).
 */
export function useEmbedResize(reportWhen?: unknown) {
  const reportRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (!isEmbedded()) return

    const el = document.documentElement
    el.dataset.embedded = 'true'

    const report = () => {
      const width = document.documentElement.scrollWidth
      const height = document.documentElement.scrollHeight
      sendResize(width, height)
    }
    reportRef.current = report

    report()

    const ro = new ResizeObserver(() => {
      report()
    })
    ro.observe(document.body)

    return () => {
      delete el.dataset.embedded
      ro.disconnect()
    }
  }, [])

  // Report again when dependency changes (e.g. route change or after async content loads) so parent gets correct height
  useEffect(() => {
    if (!isEmbedded()) return
    const width = document.documentElement.scrollWidth
    // Shrink iframe to minimum immediately so the new page doesn't sit in a huge margin
    sendResize(width, EMBED_RESIZE_MIN_HEIGHT)
    // After the new page has laid out, send the real height
    const id = requestAnimationFrame(() => {
      reportRef.current()
    })
    return () => cancelAnimationFrame(id)
  }, [reportWhen])
}

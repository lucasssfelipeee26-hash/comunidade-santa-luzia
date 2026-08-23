import React, { forwardRef } from "react"
import { navigate } from "./next-navigation"

type Href = string | { pathname?: string; query?: Record<string, string | number | boolean | null | undefined>; hash?: string }
type Props = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: Href
  replace?: boolean
  scroll?: boolean
  prefetch?: boolean | null
}

function serializeHref(href: Href) {
  if (typeof href === "string") return href
  const pathname = href.pathname || "/"
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(href.query || {})) if (value != null) params.set(key, String(value))
  const search = params.toString()
  const hash = href.hash ? (href.hash.startsWith("#") ? href.hash : `#${href.hash}`) : ""
  return `${pathname}${search ? `?${search}` : ""}${hash}`
}

const Link = forwardRef<HTMLAnchorElement, Props>(function LocalNextLink({ href, replace = false, onClick, target, download, ...props }, ref) {
  const resolved = serializeHref(href)
  return <a ref={ref} href={resolved} target={target} download={download} {...props} onClick={(event) => {
    onClick?.(event)
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || target === "_blank" || download) return
    let url: URL
    try { url = new URL(resolved, window.location.href) } catch { return }
    if (url.origin !== window.location.origin) return
    event.preventDefault()
    navigate(`${url.pathname}${url.search}${url.hash}`, replace)
  }} />
})

export default Link

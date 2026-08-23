import React from "react"

type Props = Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "width" | "height"> & {
  src: string | { src: string }
  width?: number | `${number}`
  height?: number | `${number}`
  fill?: boolean
  priority?: boolean
  sizes?: string
  quality?: number
}

export default function Image({ src, fill, priority, style, width, height, alt = "", ...props }: Props) {
  const value = typeof src === "string" ? src : src.src
  return <img
    src={value}
    alt={alt}
    width={fill ? undefined : width}
    height={fill ? undefined : height}
    loading={priority ? "eager" : props.loading}
    {...props}
    style={fill ? { position: "absolute", inset: 0, width: "100%", height: "100%", ...style } : style}
  />
}

import * as React from "react"
import { cn } from "@/lib/utils"

const Avatar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
      className
    )}
    {...props}
  />
))
Avatar.displayName = "Avatar"

const AvatarImage = React.forwardRef<
  HTMLImageElement,
  React.ImgHTMLAttributes<HTMLImageElement> & {
    onLoadingStatusChange?: (status: 'idle' | 'loading' | 'loaded' | 'error') => void
  }
>(({ className, onLoadingStatusChange, ...props }, ref) => {
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')

  React.useEffect(() => {
    if (props.src) {
      setStatus('loading')
      onLoadingStatusChange?.('loading')
    }
  }, [props.src, onLoadingStatusChange])

  const handleLoad = () => {
    setStatus('loaded')
    onLoadingStatusChange?.('loaded')
  }

  const handleError = () => {
    setStatus('error')
    onLoadingStatusChange?.('error')
  }

  if (status === 'error' || !props.src) {
    return null
  }

  return (
    <img
      ref={ref}
      className={cn("aspect-square h-full w-full object-cover", className)}
      onLoad={handleLoad}
      onError={handleError}
      {...props}
    />
  )
})
AvatarImage.displayName = "AvatarImage"

const AvatarFallback = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted",
      className
    )}
    {...props}
  />
))
AvatarFallback.displayName = "AvatarFallback"

export { Avatar, AvatarImage, AvatarFallback }
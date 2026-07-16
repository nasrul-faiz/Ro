import { cn } from "@/lib/utils"

interface LoadingTextProps {
  text?: string
  className?: string
}

export function LoadingText({ text = "Loading", className }: LoadingTextProps) {
  return (
    <div
      className={cn(
        "py-10 text-center text-sm text-muted-foreground",
        className
      )}
    >
      <span>{text}</span>
      <span className="inline-flex w-4 justify-start">
        <span className="animate-[loading-dot_1.4s_ease-in-out_infinite]">.</span>
        <span className="animate-[loading-dot_1.4s_ease-in-out_0.2s_infinite]">.</span>
        <span className="animate-[loading-dot_1.4s_ease-in-out_0.4s_infinite]">.</span>
      </span>
    </div>
  )
}

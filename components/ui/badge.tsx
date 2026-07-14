import * as React from "react"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline"
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  let baseClasses = "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";
  
  if (variant === "default") baseClasses += " border-transparent bg-blue-600 text-white shadow hover:bg-blue-700";
  else if (variant === "secondary") baseClasses += " border-transparent bg-gray-100 text-gray-900 hover:bg-gray-200";
  else if (variant === "destructive") baseClasses += " border-transparent bg-red-600 text-white shadow hover:bg-red-700";
  else if (variant === "outline") baseClasses += " text-foreground";
  
  return (
    <div className={`${baseClasses} ${className || ""}`} {...props} />
  )
}

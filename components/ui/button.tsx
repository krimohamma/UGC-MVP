import * as React from "react"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon"
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    let baseClasses = "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";
    
    if (variant === "default") baseClasses += " bg-blue-600 text-white shadow hover:bg-blue-700";
    else if (variant === "destructive") baseClasses += " bg-red-600 text-white shadow-sm hover:bg-red-700";
    else if (variant === "outline") baseClasses += " border border-gray-300 bg-white shadow-sm hover:bg-gray-100 hover:text-gray-900";
    else if (variant === "secondary") baseClasses += " bg-gray-100 text-gray-900 shadow-sm hover:bg-gray-200";
    else if (variant === "ghost") baseClasses += " hover:bg-gray-100 hover:text-gray-900";
    else if (variant === "link") baseClasses += " text-blue-600 underline-offset-4 hover:underline";

    if (size === "default") baseClasses += " h-9 px-4 py-2";
    else if (size === "sm") baseClasses += " h-8 rounded-md px-3 text-xs";
    else if (size === "lg") baseClasses += " h-10 rounded-md px-8";
    else if (size === "icon") baseClasses += " h-9 w-9";

    return (
      <button
        className={`${baseClasses} ${className || ""}`}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

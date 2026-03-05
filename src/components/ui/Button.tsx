import { type ButtonHTMLAttributes, forwardRef } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "default" | "lg";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", size = "default", children, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center gap-2 justify-center rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";

    const variants = {
      primary: "bg-accent text-white hover:bg-accent/90 focus:ring-accent",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80 focus:ring-secondary",
      ghost: "bg-transparent text-foreground hover:bg-foreground/10 focus:ring-foreground",
    };

    const sizes = {
      sm: "px-3 py-1.5 text-sm",
      default: "px-5 py-2.5 text-base",
      lg: "px-8 py-3 text-lg",
    };

    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
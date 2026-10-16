import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/app/lib/utils";

const button = cva(
  "group relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,color,box-shadow,transform,opacity] duration-300 ease-[var(--ease-press)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        primary:
          "rounded-full bg-brick text-sheet shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_10px_24px_-12px_rgb(127_49_28/0.7)] hover:bg-brick-deep",
        ink: "rounded-full bg-ink text-sheet shadow-[inset_0_1px_0_rgb(255_255_255/0.12)] hover:bg-ink-2",
        outline:
          "rounded-full bg-plaster text-ink shadow-[0_0_0_1px_var(--color-line-strong),0_1px_2px_rgb(30_27_23/0.06)] hover:shadow-[0_0_0_1px_var(--color-graphite),0_1px_2px_rgb(30_27_23/0.06)]",
        ghost: "rounded-full text-graphite hover:bg-wash hover:text-ink",
        glass:
          "rounded-full bg-night/70 text-sheet shadow-[inset_0_1px_0_rgb(255_255_255/0.1),0_0_0_1px_rgb(255_255_255/0.08)] backdrop-blur-xl hover:bg-night/85",
        danger: "rounded-full bg-fail text-sheet hover:bg-[#8f1d22]",
      },
      size: {
        xs: "h-7 px-3 text-[12px]",
        sm: "h-8 px-3.5 text-[13px]",
        md: "h-10 px-4.5 text-[14px]",
        lg: "h-12 px-6 text-[15px]",
        xl: "h-14 px-7 text-[16px]",
      },
    },
    defaultVariants: { variant: "outline", size: "md" },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof button> {
  loading?: boolean;
  icon?: ReactNode;
  /** Trailing icon rendered in its own nested circle ("button in button"). */
  trailing?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, loading, icon, trailing, children, disabled, ...rest },
  ref,
) {
  const nested = trailing && (variant === "primary" || variant === "ink" || variant === "glass");
  return (
    <button
      ref={ref}
      className={cn(button({ variant, size }), nested && "pr-1.5", className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" strokeWidth={1.75} /> : icon}
      {children}
      {trailing &&
        (nested ? (
          <span
            className={cn(
              "ml-1 grid place-items-center rounded-full bg-white/14 transition-transform duration-500 ease-[var(--ease-out-quint)] group-hover:translate-x-0.5 group-hover:-translate-y-px",
              size === "xl" || size === "lg" ? "size-9" : size === "xs" || size === "sm" ? "size-6" : "size-7",
            )}
          >
            {trailing}
          </span>
        ) : (
          <span className="transition-transform duration-500 ease-[var(--ease-out-quint)] group-hover:translate-x-0.5">{trailing}</span>
        ))}
    </button>
  );
});

export function IconButton({
  className,
  label,
  children,
  tone = "light",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; tone?: "light" | "dark" }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        "inline-grid size-8 shrink-0 place-items-center rounded-full transition-[background-color,color,transform] duration-200 active:scale-95 disabled:opacity-40",
        tone === "light" ? "text-graphite hover:bg-wash hover:text-ink" : "text-sheet/80 hover:bg-white/10 hover:text-sheet",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

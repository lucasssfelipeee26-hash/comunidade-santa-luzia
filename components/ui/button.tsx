import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  "group/button inline-flex min-w-0 max-w-full select-none items-center justify-center whitespace-normal break-words rounded-2xl border border-transparent bg-clip-padding text-center text-sm font-semibold leading-snug outline-none transition-[transform,box-shadow,background-color,border-color,color] duration-200 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 active:scale-[.975] disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground shadow-[0_7px_18px_rgba(92,19,38,.16)] hover:-translate-y-px hover:bg-primary/92 hover:shadow-[0_10px_24px_rgba(92,19,38,.20)]',
        outline: 'border-border/90 bg-background/90 text-foreground shadow-sm hover:-translate-y-px hover:border-primary/25 hover:bg-muted/70',
        secondary: 'bg-secondary text-secondary-foreground shadow-sm hover:-translate-y-px hover:bg-secondary/80',
        ghost: 'text-foreground hover:bg-muted/80',
        destructive: 'bg-destructive/10 text-destructive hover:bg-destructive/18',
        link: 'rounded-lg px-1 text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'min-h-11 gap-2 px-4 py-2.5',
        xs: 'min-h-8 gap-1 rounded-xl px-2.5 py-1 text-xs',
        sm: 'min-h-10 gap-1.5 rounded-xl px-3.5 py-2 text-[0.82rem]',
        lg: 'min-h-12 gap-2 px-5 py-3 text-[0.95rem]',
        icon: 'size-11 shrink-0 p-0',
        'icon-xs': 'size-8 shrink-0 rounded-xl p-0',
        'icon-sm': 'size-10 shrink-0 rounded-xl p-0',
        'icon-lg': 'size-12 shrink-0 p-0',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }

function Button({ className, variant = 'default', size = 'default', asChild = false, children, ...props }: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size, className }))
  if (asChild && React.isValidElement(children)) {
    const child = children as React.ReactElement<{ className?: string }>
    return React.cloneElement(child, { className: cn(classes, child.props.className) })
  }
  return (
    <button data-slot="button" className={classes} {...props}>
      {children}
    </button>
  )
}

export { Button, buttonVariants }

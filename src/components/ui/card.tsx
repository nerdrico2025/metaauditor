import * as React from "react";

import { cva, type VariantProps } from "class-variance-authority";



import { cn } from "@/lib/utils";



const cardVariants = cva("rounded-xl bg-card text-card-foreground", {

  variants: {

    variant: {

      default: "border-0 shadow-soft bg-card",

      elevated:

        "border-0 shadow-elevated bg-card/85 backdrop-blur-sm rounded-2xl",

      interactive:

        "border-0 shadow-elevated bg-card/85 backdrop-blur-sm rounded-2xl hover-lift cursor-pointer active:scale-[0.99] transition-transform",

      glass:

        "border-0 shadow-elevated bg-card/85 backdrop-blur-sm rounded-2xl",

    },

  },

  defaultVariants: {

    variant: "default",

  },

});



export interface CardProps

  extends React.HTMLAttributes<HTMLDivElement>,

    VariantProps<typeof cardVariants> {}



const Card = React.forwardRef<HTMLDivElement, CardProps>(

  ({ className, variant, ...props }, ref) => (

    <div ref={ref} className={cn(cardVariants({ variant }), className)} {...props} />

  ),

);

Card.displayName = "Card";



const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(

  ({ className, ...props }, ref) => (

    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />

  ),

);

CardHeader.displayName = "CardHeader";



const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(

  ({ className, ...props }, ref) => (

    <h3 ref={ref} className={cn("text-2xl font-semibold leading-none tracking-tight", className)} {...props} />

  ),

);

CardTitle.displayName = "CardTitle";



const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(

  ({ className, ...props }, ref) => (

    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />

  ),

);

CardDescription.displayName = "CardDescription";



const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(

  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />,

);

CardContent.displayName = "CardContent";



const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(

  ({ className, ...props }, ref) => (

    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />

  ),

);

CardFooter.displayName = "CardFooter";



export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent, cardVariants };


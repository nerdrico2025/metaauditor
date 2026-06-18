import { cn } from '@/lib/utils';



interface SectionHeaderProps {

  title: string;

  description?: string;

  actions?: React.ReactNode;

  className?: string;

  size?: 'default' | 'large';

}



export function SectionHeader({

  title,

  description,

  actions,

  className,

  size = 'default',

}: SectionHeaderProps) {

  return (

    <div className={cn('flex flex-col gap-1 lg:flex-row lg:items-end lg:justify-between', className)}>

      <div className="space-y-0.5 min-w-0">

        <h1

          className={cn(

            'font-semibold tracking-tight text-foreground',

            size === 'large' ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl',

          )}

        >

          {title}

        </h1>

        {description && (

          <p className="text-sm text-muted-foreground max-w-2xl">{description}</p>

        )}

      </div>

      {actions && (

        <div className="flex flex-wrap items-center gap-2 min-w-0 mt-2 lg:mt-0 lg:justify-end w-full lg:w-auto">

          {actions}

        </div>

      )}

    </div>

  );

}



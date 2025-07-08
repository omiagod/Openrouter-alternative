import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  className?: string;
  text?: string;
}

const sizeClasses = {
  small: 'h-4 w-4',
  medium: 'h-6 w-6',
  large: 'h-8 w-8',
};

export default function LoadingSpinner({ 
  size = 'medium', 
  className,
  text 
}: LoadingSpinnerProps) {
  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div className="flex flex-col items-center gap-2">
        <div
          className={cn(
            'animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary',
            sizeClasses[size]
          )}
        />
        {text && (
          <p className="text-sm text-muted-foreground">{text}</p>
        )}
      </div>
    </div>
  );
}

// Utility function for className merging (simple version)
// In a real project, you might use clsx or a similar library
function cn(...classes: (string | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

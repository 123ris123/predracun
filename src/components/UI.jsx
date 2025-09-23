import { cn } from '../lib/utils.js'

export function Card({className, ...props}){
  return (
    <div
      className={cn(
        'bg-white/80 dark:bg-neutral-900/60 border border-neutral-200 dark:border-neutral-800 rounded-2xl p-4 shadow-sm dark:shadow-none fade-up',
        className
      )}
      {...props}
    />
  )
}

export function Button({className, ...props}){
  return (
    <button
      className={cn(
        'px-4 py-2 rounded-xl touch-btn text-white bg-brand hover:bg-brand-dark active:scale-[0.99] transition',
        className
      )}
      {...props}
    />
  )
}

export function Input({className, ...props}){
  return (
    <input
      className={cn(
        'px-3 py-2 rounded-xl w-full outline-none transition',
        'bg-white border border-neutral-300 text-neutral-900',
        'dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-100',
        'focus:ring-2 ring-brand',
        className
      )}
      {...props}
    />
  )
}

export function Label({className, ...props}){
  return <label className={cn('text-sm opacity-80', className)} {...props}/>
}

export function Badge({className, ...props}){
  return (
    <span
      className={cn(
        'text-xs px-2 py-1 rounded-md border',
        'bg-white border-neutral-300 text-neutral-800',
        'dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-100',
        className
      )}
      {...props}
    />
  )
}

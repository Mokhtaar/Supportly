import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const saveInBackground = (promise: Promise<unknown>, label: string) => {
  promise.catch(error => console.error(`Background save failed (${label}):`, error));
};

import * as React from "react"
import { cn } from "@/lib/utils"

export type JobState =
    | 'pending'
    | 'in progress'
    | 'completed'
    | 'failed'
    | 'cancelled'
    | 'unknown';

const STATE_STYLES: Record<JobState, string> = {
    'pending':     'bg-slate-100  text-slate-700  dark:bg-slate-800/60  dark:text-slate-300',
    'in progress': 'bg-blue-100   text-blue-800   dark:bg-blue-900/30   dark:text-blue-400',
    'completed':   'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
    'failed':      'bg-red-100    text-red-800    dark:bg-red-900/30    dark:text-red-400',
    'cancelled':   'bg-amber-100  text-amber-800  dark:bg-amber-900/30  dark:text-amber-400',
    'unknown':     'bg-muted      text-muted-foreground',
};

const STATE_LABELS: Record<JobState, string> = {
    'pending':     'Pending',
    'in progress': 'In Progress',
    'completed':   'Completed',
    'failed':      'Failed',
    'cancelled':   'Cancelled',
    'unknown':     'Unknown',
};

interface StateBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
    state: JobState;
}

export function StateBadge({ state, className, ...props }: StateBadgeProps) {
    return (
        <div
            className={cn(
                'inline-flex items-center rounded-full border-0 px-2 py-0.5 text-xs font-semibold',
                STATE_STYLES[state] ?? STATE_STYLES['unknown'],
                className
            )}
            {...props}
        >
            {STATE_LABELS[state] ?? state}
        </div>
    );
}

/**
 * Converts the numeric state integer from the API to a JobState string.
 *   0 → pending
 *   1 → in progress
 *   2 → completed
 *   3 → failed
 *   4 → cancelled
 */
export function stateFromNumber(state: number | undefined | null): JobState {
    switch (state) {
        case 0: return 'pending';
        case 1: return 'in progress';
        case 2: return 'completed';
        case 3: return 'failed';
        case 4: return 'cancelled';
        default: return 'unknown';
    }
}


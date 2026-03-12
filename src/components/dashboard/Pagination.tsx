import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageSizeSelect } from '@/components/dashboard/PageSizeSelect';

interface PaginationProps {
    page: number;
    totalPages: number;
    totalItems: number;
    pageSize: number;
    onPage: (page: number) => void;
    onPageSize: (size: number) => void;
    disabled?: boolean;
}

export function Pagination({ page, totalPages, totalItems, pageSize, onPage, onPageSize, disabled }: PaginationProps) {
    const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
    const to   = Math.min(page * pageSize, totalItems);

    return (
        <div className="flex items-center gap-3 text-sm text-muted-foreground select-none">
            {/* Page size selector */}
            <PageSizeSelect
                value={pageSize}
                onChange={onPageSize}
                disabled={disabled}
            />

            {/* Item range */}
            <span className="tabular-nums">
                {totalItems === 0 ? '0 items' : `${from}–${to} of ${totalItems.toLocaleString()}`}
            </span>

            <div className="flex items-center gap-1">
                {/* First */}
                <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7"
                    disabled={disabled || page <= 1}
                    onClick={() => onPage(1)}
                    title="First page"
                >
                    <ChevronsLeft className="w-4 h-4" />
                </Button>

                {/* Previous */}
                <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7"
                    disabled={disabled || page <= 1}
                    onClick={() => onPage(page - 1)}
                    title="Previous page"
                >
                    <ChevronLeft className="w-4 h-4" />
                </Button>

                {/* Page indicator */}
                <span className="px-2 tabular-nums text-foreground font-medium">
                    {page} / {totalPages}
                </span>

                {/* Next */}
                <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7"
                    disabled={disabled || page >= totalPages}
                    onClick={() => onPage(page + 1)}
                    title="Next page"
                >
                    <ChevronRight className="w-4 h-4" />
                </Button>

                {/* Last */}
                <Button
                    variant="ghost" size="icon"
                    className="h-7 w-7"
                    disabled={disabled || page >= totalPages}
                    onClick={() => onPage(totalPages)}
                    title="Last page"
                >
                    <ChevronsRight className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
}

import * as React from "react";
import { cn } from "@/lib/utils";

export const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="w-full overflow-auto rounded-lg border">
      <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  ),
);
Table.displayName = "Table";

export const THead = (p: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <thead {...p} className={cn("bg-secondary/60 text-xs uppercase tracking-wider", p.className)} />
);
export const TBody = (p: React.HTMLAttributes<HTMLTableSectionElement>) => (
  <tbody {...p} className={cn("divide-y", p.className)} />
);
export const TR = (p: React.HTMLAttributes<HTMLTableRowElement>) => (
  <tr {...p} className={cn("hover:bg-secondary/40", p.className)} />
);
export const TH = (p: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th {...p} className={cn("px-3 py-2 text-left font-semibold text-muted-foreground", p.className)} />
);
export const TD = (p: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td {...p} className={cn("px-3 py-2 align-middle", p.className)} />
);

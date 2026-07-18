"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  Row,
  Column,
} from "@tanstack/react-table"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable"
import {
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ChevronDown, MoreHorizontal, Search, ArrowUpDown, GripVertical, Filter } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useState } from "react"

// Resizable column component interface (for future implementation)
interface ResizableColumnProps {
  column: Column<any>
  children: React.ReactNode
  className?: string
}

function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto"
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "joveo-table-row",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "joveo-table-header th text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "joveo-table-cell align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  )
}

// Enhanced ResizableColumn component (for future implementation)
// function ResizableColumn({ column, children, className }: ResizableColumnProps) {
//   // Column resizing functionality will be implemented in future versions
//   return <div className={cn("relative", className)}>{children}</div>
// }

// Enhanced SortableHeader component
interface SortableHeaderProps {
  column: Column<any>
  children: React.ReactNode
  className?: string
}

function SortableHeader({ column, children, className }: SortableHeaderProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("flex items-center gap-2", className)}
    >
      {/* Drag handle - separate from sortable content */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-move p-1 hover:bg-[#F0F4FF] rounded transition-colors"
      >
        <GripVertical className="w-4 h-4 text-[#7681E8]" />
      </div>
      {/* Sortable content */}
      {children}
    </div>
  )
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchPlaceholder?: string
  enableSearch?: boolean
  enableColumnVisibility?: boolean
  enableColumnReordering?: boolean
  enableColumnResizing?: boolean
  enablePagination?: boolean
  pageSize?: number
  className?: string
  onRowClick?: (row: Row<TData>) => void
  showTotalRow?: boolean
  totalRowData?: Partial<TData>
  enableGlobalSearch?: boolean
  enableColumnFilters?: boolean
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchPlaceholder = "Search all columns...",
  enableSearch = true,
  enableColumnVisibility = true,
  enableColumnReordering = true,
  enableColumnResizing = false,
  enablePagination = true,
  pageSize = 20,
  className,
  onRowClick,
  showTotalRow = false,
  totalRowData = {},
  enableGlobalSearch = true,
  enableColumnFilters = true,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [columnOrder, setColumnOrder] = React.useState<string[]>(columns.map(col => col.id || ''))

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    onColumnOrderChange: setColumnOrder,
    globalFilterFn: "includesString",
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
      columnOrder,
    },
    initialState: {
      pagination: {
        pageSize,
      },
      columnOrder: columns.map(col => col.id || ''),
    },
  })

  // Handle column reordering
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      const oldIndex = columnOrder.findIndex(id => id === active.id)
      const newIndex = columnOrder.findIndex(id => id === over?.id)
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newColumnOrder = arrayMove(columnOrder, oldIndex, newIndex)
        setColumnOrder(newColumnOrder)
      }
    }
  }

  // Add total row if enabled
  const displayData = React.useMemo(() => {
    if (!showTotalRow) return data
    
    const totalRow = { ...totalRowData, id: 'total' } as TData
    return [totalRow, ...data]
  }, [data, showTotalRow, totalRowData])

  // Get unique values for column filters
  const getColumnFilterValues = (columnId: string) => {
    const values = new Set<string>()
    data.forEach(row => {
      const value = row[columnId as keyof TData]
      if (value !== undefined && value !== null) {
        values.add(String(value))
      }
    })
    return Array.from(values).sort()
  }

  return (
    <div className={cn("w-full space-y-4", className)}>
      {/* Enhanced Search and Controls */}
      <div className="joveo-table-search flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          {enableGlobalSearch && (
            <div className="flex items-center space-x-3">
              <Search className="w-5 h-5 text-[#7681E8]" />
              <Input
                placeholder={searchPlaceholder}
                value={globalFilter ?? ""}
                onChange={(event) => setGlobalFilter(event.target.value)}
                className="joveo-input max-w-sm"
              />
            </div>
          )}
          
          {enableColumnFilters && (
            <div className="flex items-center">
              <div className="flex items-center space-x-2 mr-2">
                <Filter className="w-4 h-4 text-[#7681E8]" />
                <span className="text-sm text-[#3D4759] whitespace-nowrap">Filters:</span>
              </div>
              <div className="overflow-x-auto flex items-center space-x-2 pb-2 max-w-[600px] thin-scrollbar">
                {table.getAllColumns()
                  .filter(column => column.getCanFilter())
                  .map(column => {
                    const filterValue = column.getFilterValue()
                    const filterValues = getColumnFilterValues(column.id)
                    
                    return (
                      <select
                        key={column.id}
                        value={filterValue as string || ""}
                        onChange={(e) => column.setFilterValue(e.target.value || undefined)}
                        className="joveo-input h-8 px-2 py-1 text-sm min-w-[120px] shrink-0"
                      >
                        <option value="">All {column.id}</option>
                        {filterValues.map(value => (
                          <option key={value} value={value}>
                            {value}
                          </option>
                        ))}
                      </select>
                    )
                  })}
              </div>
            </div>
          )}
        </div>
        
        {enableColumnVisibility && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="joveo-button-outline ml-auto">
                Columns <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-white border-[#E1E8FF]">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize text-[#3D4759] hover:bg-[#F0F4FF]"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Table */}
      <div className="joveo-table-container thin-scrollbar">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id} className="joveo-table-header">
                  {headerGroup.headers.map((header) => {
                    const isSortable = header.column.getCanSort()
                    const isSorted = header.column.getIsSorted()
                    
                    return (
                      <TableHead
                        key={header.id}
                        className={cn(
                          "joveo-table-header th text-left align-middle",
                          enableColumnResizing && "relative",
                          header.column.getCanSort() && "cursor-pointer select-none"
                        )}
                        style={{
                          width: header.column.columnDef.size ? `${header.column.columnDef.size}px` : undefined,
                          minWidth: header.column.columnDef.minSize,
                          maxWidth: header.column.columnDef.maxSize,
                        }}
                      >
                        {enableColumnReordering ? (
                          <SortableHeader column={header.column}>
                            <div
                              className={cn(
                                "flex items-center gap-2",
                                isSortable && "hover:text-[#303F9F] transition-colors"
                              )}
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                              {isSortable && (
                                <ArrowUpDown className="w-4 h-4 joveo-sort-icon" />
                              )}
                              {isSorted === "asc" && (
                                <ChevronDown className="w-4 h-4 joveo-sort-active rotate-180" />
                              )}
                              {isSorted === "desc" && (
                                <ChevronDown className="w-4 h-4 joveo-sort-active" />
                              )}
                            </div>
                          </SortableHeader>
                        ) : (
                          <div
                            className={cn(
                              "flex items-center gap-2",
                              isSortable && "hover:text-[#303F9F] cursor-pointer transition-colors"
                            )}
                            onClick={header.column.getToggleSortingHandler()}
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                            {isSortable && (
                              <ArrowUpDown className="w-4 h-4 joveo-sort-icon" />
                            )}
                            {isSorted === "asc" && (
                              <ChevronDown className="w-4 h-4 joveo-sort-active rotate-180" />
                            )}
                            {isSorted === "desc" && (
                              <ChevronDown className="w-4 h-4 joveo-sort-active" />
                            )}
                          </div>
                        )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                    className={cn(
                      "joveo-table-row",
                      onRowClick && "cursor-pointer",
                      row.id === 'total' && "bg-[#E8F5E8] font-semibold"
                    )}
                    onClick={() => onRowClick?.(row)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className="joveo-table-cell"
                        style={{
                          width: cell.column.columnDef.size ? `${cell.column.columnDef.size}px` : undefined,
                          minWidth: cell.column.columnDef.minSize,
                          maxWidth: cell.column.columnDef.maxSize,
                        }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center text-gray-500"
                  >
                    No results found. Try adjusting your search or filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DndContext>
      </div>

      {/* Enhanced Pagination */}
      {enablePagination && (
        <div className="joveo-table-pagination flex items-center justify-between space-x-2">
          <div className="flex-1 text-sm text-[#3D4759]">
            Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1} to{" "}
            {Math.min(
              (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
              table.getFilteredRowModel().rows.length
            )}{" "}
            of {table.getFilteredRowModel().rows.length} results
            {table.getFilteredSelectedRowModel().rows.length > 0 && (
              <span className="ml-2">
                ({table.getFilteredSelectedRowModel().rows.length} selected)
              </span>
            )}
          </div>
          <div className="flex items-center space-x-6 lg:space-x-8">
            <div className="flex items-center space-x-2">
              <p className="text-sm font-medium text-[#3D4759]">Rows per page</p>
              <select
                value={table.getState().pagination.pageSize}
                onChange={(e) => {
                  table.setPageSize(Number(e.target.value))
                }}
                className="joveo-input h-8 w-[70px] rounded px-2 py-1 text-sm"
              >
                {[10, 20, 30, 40, 50, 100].map((pageSize) => (
                  <option key={pageSize} value={pageSize}>
                    {pageSize}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex w-[100px] items-center justify-center text-sm font-medium text-[#1C2536]">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                className="joveo-button-outline hidden h-8 w-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to first page</span>
                <ChevronDown className="h-4 w-4 rotate-90" />
              </Button>
              <Button
                variant="outline"
                className="joveo-button-outline h-8 w-8 p-0"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronDown className="h-4 w-4 rotate-90" />
              </Button>
              <Button
                variant="outline"
                className="joveo-button-outline h-8 w-8 p-0"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronDown className="h-4 w-4 -rotate-90" />
              </Button>
              <Button
                variant="outline"
                className="joveo-button-outline hidden h-8 w-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to last page</span>
                <ChevronDown className="h-4 w-4 -rotate-90" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

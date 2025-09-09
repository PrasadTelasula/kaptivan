'use client'

import type { CSSProperties } from 'react'
import { useState, useId, useMemo } from 'react'
import { ChevronDownIcon, ChevronUpIcon, GripVerticalIcon } from 'lucide-react'

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers'
import { arrayMove, horizontalListSortingStrategy, SortableContext, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Cell, ColumnDef, Header, SortingState } from '@tanstack/react-table'
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'

import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface DraggableQueryTableProps {
  data: any[]
  isLoading?: boolean
}

export function DraggableQueryTable({ data, isLoading }: DraggableQueryTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  
  // Generate columns dynamically from data
  const columns: ColumnDef<any>[] = useMemo(() => {
    if (!data || data.length === 0) return []
    
    const firstRow = data[0]
    return Object.keys(firstRow).map(key => ({
      id: key,
      header: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
      // Use accessor function instead of accessorKey for fields with dots
      accessorFn: (row: any) => row[key],
      cell: ({ getValue }) => {
        const value = getValue()
        
        // Special formatting for specific columns
        if (key === 'cluster') {
          return (
            <Badge variant="outline" className="text-xs">
              {value as string}
            </Badge>
          )
        }
        
        if (key === 'phase' || key === 'status') {
          // Check if value is an object (like pod status object)
          if (typeof value === 'object' && value !== null) {
            return (
              <span className="font-mono text-xs truncate" title={JSON.stringify(value, null, 2)}>
                {JSON.stringify(value).substring(0, 50)}...
              </span>
            )
          }
          
          const status = value as string
          return (
            <Badge 
              variant={status === 'Running' || status === 'Active' ? 'default' : 'secondary'}
              className={cn(
                "text-xs",
                status === 'Running' && "bg-green-500/10 text-green-700 border-green-500/30",
                status === 'Failed' && "bg-red-500/10 text-red-700 border-red-500/30",
                status === 'Pending' && "bg-yellow-500/10 text-yellow-700 border-yellow-500/30",
                status === 'Active' && "bg-blue-500/10 text-blue-700 border-blue-500/30"
              )}
            >
              {status}
            </Badge>
          )
        }
        
        if (key === 'ready' || key === 'desired' || key === 'replicas') {
          return <div className="font-medium">{value as string}</div>
        }
        
        // Default rendering
        if (value === null || value === undefined) {
          return <span className="text-muted-foreground">-</span>
        }
        
        if (typeof value === 'object') {
          // For arrays, show count and preview
          if (Array.isArray(value)) {
            return (
              <span className="font-mono text-xs" title={JSON.stringify(value, null, 2)}>
                [{value.length} items]
              </span>
            )
          }
          
          // For objects, show truncated JSON
          const jsonStr = JSON.stringify(value)
          const displayStr = jsonStr.length > 50 ? jsonStr.substring(0, 50) + '...' : jsonStr
          return (
            <span className="font-mono text-xs truncate" title={JSON.stringify(value, null, 2)}>
              {displayStr}
            </span>
          )
        }
        
        return <div className="truncate" title={String(value)}>{String(value)}</div>
      },
      sortUndefined: 'last',
      sortDescFirst: false
    }))
  }, [data])

  const [columnOrder, setColumnOrder] = useState<string[]>(
    columns.map(column => column.id as string)
  )

  const table = useReactTable({
    data,
    columns,
    columnResizeMode: 'onChange',
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: {
      sorting,
      columnOrder
    },
    onColumnOrderChange: setColumnOrder,
    enableSortingRemoval: false
  })

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    if (active && over && active.id !== over.id) {
      setColumnOrder(columnOrder => {
        const oldIndex = columnOrder.indexOf(active.id as string)
        const newIndex = columnOrder.indexOf(over.id as string)

        return arrayMove(columnOrder, oldIndex, newIndex)
      })
    }
  }

  const sensors = useSensors(
    useSensor(MouseSensor, {}), 
    useSensor(TouchSensor, {}), 
    useSensor(KeyboardSensor, {})
  )

  if (!data || data.length === 0) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableBody>
            <TableRow>
              <TableCell className="h-24 text-center">
                No results found
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="rounded-md border">
        <DndContext
          id={useId()}
          collisionDetection={closestCenter}
          modifiers={[restrictToHorizontalAxis]}
          onDragEnd={handleDragEnd}
          sensors={sensors}
        >
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map(headerGroup => (
                <TableRow key={headerGroup.id} className="bg-muted/50 [&>th]:border-t-0">
                  <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                    {headerGroup.headers.map(header => (
                      <DraggableTableHeader key={header.id} header={header} />
                    ))}
                  </SortableContext>
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map(row => (
                  <TableRow 
                    key={row.id} 
                    data-state={row.getIsSelected() && 'selected'}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    {row.getVisibleCells().map(cell => (
                      <SortableContext key={cell.id} items={columnOrder} strategy={horizontalListSortingStrategy}>
                        <DragAlongCell key={cell.id} cell={cell} />
                      </SortableContext>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </DndContext>
      </div>
    </div>
  )
}

const DraggableTableHeader = ({ header }: { header: Header<any, unknown> }) => {
  const { attributes, isDragging, listeners, setNodeRef, transform, transition } = useSortable({
    id: header.column.id
  })

  const style: CSSProperties = {
    opacity: isDragging ? 0.8 : 1,
    position: 'relative',
    transform: CSS.Translate.toString(transform),
    transition,
    whiteSpace: 'nowrap',
    width: header.column.getSize(),
    zIndex: isDragging ? 1 : 0
  }

  return (
    <TableHead
      ref={setNodeRef}
      className="before:bg-border relative h-10 border-t before:absolute before:inset-y-0 before:start-0 before:w-px first:before:bg-transparent"
      style={style}
      aria-sort={
        header.column.getIsSorted() === 'asc'
          ? 'ascending'
          : header.column.getIsSorted() === 'desc'
            ? 'descending'
            : 'none'
      }
    >
      <div className="flex items-center justify-start gap-0.5">
        <Button
          size="icon"
          variant="ghost"
          className="-ml-2 size-7 shadow-none"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
        >
          <GripVerticalIcon className="opacity-60" size={16} aria-hidden="true" />
        </Button>
        <span className="grow truncate text-sm font-medium">
          {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
        </span>
        <Button
          size="icon"
          variant="ghost"
          className="group -mr-1 size-7 shadow-none"
          onClick={header.column.getToggleSortingHandler()}
          onKeyDown={e => {
            if (header.column.getCanSort() && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              header.column.getToggleSortingHandler()?.(e)
            }
          }}
          aria-label="Toggle sorting"
        >
          {{
            asc: <ChevronUpIcon className="shrink-0 opacity-60" size={16} aria-hidden="true" />,
            desc: <ChevronDownIcon className="shrink-0 opacity-60" size={16} aria-hidden="true" />
          }[header.column.getIsSorted() as string] ?? (
            <ChevronUpIcon className="shrink-0 opacity-0 group-hover:opacity-60" size={16} aria-hidden="true" />
          )}
        </Button>
      </div>
    </TableHead>
  )
}

const DragAlongCell = ({ cell }: { cell: Cell<any, unknown> }) => {
  const { isDragging, setNodeRef, transform, transition } = useSortable({
    id: cell.column.id
  })

  const style: CSSProperties = {
    opacity: isDragging ? 0.8 : 1,
    position: 'relative',
    transform: CSS.Translate.toString(transform),
    transition,
    width: cell.column.getSize(),
    zIndex: isDragging ? 1 : 0
  }

  return (
    <TableCell ref={setNodeRef} className="text-sm" style={style}>
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </TableCell>
  )
}
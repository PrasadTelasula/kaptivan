import { Search, Filter, Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { Cluster, FilterState, Namespace } from "../types"

interface NamespaceFiltersProps {
  clusters: Cluster[]
  namespaces: Namespace[]
  filters: FilterState
  onFiltersChange: (filters: FilterState) => void
}

export function NamespaceFilters({
  clusters,
  namespaces,
  filters,
  onFiltersChange
}: NamespaceFiltersProps) {
  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const clearFilters = () => {
    onFiltersChange({
      clusters: [],
      search: "",
      status: "all",
      labels: {}
    })
  }

  const hasActiveFilters = filters.clusters.length > 0 || filters.search || filters.status !== "all"

  return (
    <div className="flex gap-2 flex-1 max-w-4xl">
      <ClusterSelector
        clusters={clusters}
        value={filters.clusters}
        onChange={(value) => updateFilter("clusters", value)}
      />
      
      <NamespaceSearch
        namespaces={namespaces}
        value={filters.search}
        onChange={(value) => updateFilter("search", value)}
      />
      
      <StatusFilter
        value={filters.status}
        onChange={(value) => updateFilter("status", value)}
      />

      {hasActiveFilters && (
        <ActiveFilters
          filters={filters}
          clusters={clusters}
          onClearAll={clearFilters}
        />
      )}
    </div>
  )
}

function ClusterSelector({ 
  clusters, 
  value, 
  onChange 
}: { 
  clusters: Cluster[]
  value: string[]
  onChange: (value: string[]) => void 
}) {
  const [open, setOpen] = React.useState(false)
  const [selectAll, setSelectAll] = React.useState(value.length === 0)

  const handleToggleCluster = (clusterId: string) => {
    if (value.includes(clusterId)) {
      onChange(value.filter(id => id !== clusterId))
    } else {
      onChange([...value, clusterId])
    }
  }

  const handleSelectAll = () => {
    if (selectAll) {
      onChange(clusters.map(c => c.id))
      setSelectAll(false)
    } else {
      onChange([])
      setSelectAll(true)
    }
  }

  const selectedCount = value.length
  const displayText = selectAll || selectedCount === 0 
    ? "All clusters" 
    : selectedCount === 1 
      ? clusters.find(c => c.id === value[0])?.name 
      : `${selectedCount} clusters selected`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[280px] justify-between"
        >
          <span className="truncate">{displayText}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0">
        <Command>
          <CommandInput placeholder="Search clusters..." />
          <CommandList>
            <CommandEmpty>No cluster found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                onSelect={handleSelectAll}
                className="cursor-pointer"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    selectAll || value.length === 0 ? "opacity-100" : "opacity-0"
                  )}
                />
                All clusters
              </CommandItem>
              <div className="my-1 border-t" />
              <div className="text-xs text-muted-foreground px-2 py-1.5">
                Available Clusters
              </div>
              {clusters.map((cluster) => (
                <CommandItem
                  key={cluster.id}
                  onSelect={() => handleToggleCluster(cluster.id)}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value.includes(cluster.id) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <StatusIndicator status={cluster.status} />
                  <span className="ml-2">{cluster.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function NamespaceSearch({
  namespaces,
  value,
  onChange
}: {
  namespaces: Namespace[]
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-[200px] justify-start">
          <Search className="mr-2 h-4 w-4" />
          {value || "Search namespaces..."}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command>
          <CommandInput 
            placeholder="Search namespaces..." 
            value={value}
            onValueChange={onChange}
          />
          <CommandList>
            <CommandEmpty>No namespaces found.</CommandEmpty>
            <CommandGroup heading="Namespaces">
              {namespaces.map(ns => (
                <CommandItem
                  key={`${ns.clusterId}-${ns.name}`}
                  value={ns.name}
                  onSelect={() => {
                    onChange(ns.name)
                    setOpen(false)
                  }}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{ns.name}</span>
                    <span className="text-xs text-muted-foreground">{ns.cluster}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

function StatusFilter({
  value,
  onChange
}: {
  value: FilterState["status"]
  onChange: (value: FilterState["status"]) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Filter className="mr-2 h-4 w-4" />
          Filters
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Status</DropdownMenuLabel>
        <DropdownMenuCheckboxItem
          checked={value === "all"}
          onCheckedChange={() => onChange("all")}
        >
          All
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={value === "active"}
          onCheckedChange={() => onChange("active")}
        >
          Active
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={value === "terminating"}
          onCheckedChange={() => onChange("terminating")}
        >
          Terminating
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={value === "error"}
          onCheckedChange={() => onChange("error")}
        >
          Error
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ActiveFilters({
  filters,
  clusters,
  onClearAll
}: {
  filters: FilterState
  clusters: Cluster[]
  onClearAll: () => void
}) {
  return (
    <div className="flex gap-2 items-center">
      {filters.clusters.length > 0 && (
        <Badge variant="secondary">
          Clusters: {filters.clusters.length === clusters.length 
            ? "All" 
            : filters.clusters.length === 1
              ? clusters.find(c => c.id === filters.clusters[0])?.name
              : `${filters.clusters.length} selected`}
        </Badge>
      )}
      {filters.search && (
        <Badge variant="secondary">
          Search: {filters.search}
        </Badge>
      )}
      {filters.status !== "all" && (
        <Badge variant="secondary">
          Status: {filters.status}
        </Badge>
      )}
      <Button variant="ghost" size="sm" onClick={onClearAll}>
        Clear all
      </Button>
    </div>
  )
}

function StatusIndicator({ status }: { status: Cluster["status"] }) {
  const colors = {
    connected: "bg-green-500",
    disconnected: "bg-gray-500",
    error: "bg-red-500"
  }
  
  return <span className={`w-2 h-2 rounded-full ${colors[status]}`} />
}

import * as React from "react"
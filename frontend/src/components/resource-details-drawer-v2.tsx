import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { 
  ChevronLeft,
  ChevronRight,
  GripVertical,
  X
} from 'lucide-react'
import { ServiceDetails } from './resource-details/service-details'
// Import other resource detail components as they're created
// import { PodDetails } from './resource-details/pod-details'
// import { DeploymentDetails } from './resource-details/deployment-details'

interface ResourceDetailsDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  resource: any
  resourceType: 'pod' | 'deployment' | 'service' | 'node'
  context?: string
  onNext?: () => void
  onPrevious?: () => void
  hasNext?: boolean
  hasPrevious?: boolean
  currentIndex?: number
  totalCount?: number
}

export function ResourceDetailsDrawer({
  open,
  onOpenChange,
  resource,
  resourceType,
  context,
  onNext,
  onPrevious,
  hasNext,
  hasPrevious,
  currentIndex,
  totalCount
}: ResourceDetailsDrawerProps) {
  const [drawerWidth, setDrawerWidth] = useState(600)
  const [isResizing, setIsResizing] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)

  // Handle resize
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return
    const newWidth = window.innerWidth - e.clientX
    setDrawerWidth(Math.min(Math.max(newWidth, 400), window.innerWidth - 100))
  }, [isResizing])

  const handleMouseUp = useCallback(() => {
    setIsResizing(false)
    document.body.style.cursor = 'default'
  }, [])

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.cursor = 'default'
      }
    }
  }, [isResizing, handleMouseMove, handleMouseUp])

  if (!resource) return null

  const renderResourceDetails = () => {
    switch (resourceType) {
      case 'service':
        return <ServiceDetails service={resource} context={context} />
      case 'pod':
        // return <PodDetails pod={resource} context={context} />
        return <div className="p-4 text-sm text-muted-foreground">Pod details component coming soon...</div>
      case 'deployment':
        // return <DeploymentDetails deployment={resource} context={context} />
        return <div className="p-4 text-sm text-muted-foreground">Deployment details component coming soon...</div>
      default:
        return <div className="p-4 text-sm text-muted-foreground">Unknown resource type</div>
    }
  }

  const getResourceTitle = () => {
    switch (resourceType) {
      case 'service':
        return 'Service'
      case 'pod':
        return 'Pod'
      case 'deployment':
        return 'Deployment'
      case 'node':
        return 'Node'
      default:
        return 'Resource'
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent 
          className="p-0 flex flex-col"
          style={{ width: `${drawerWidth}px`, maxWidth: '90vw' }}
        >
          {/* Resize Handle */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1 hover:w-2 cursor-col-resize bg-transparent hover:bg-primary/10 transition-all"
            onMouseDown={(e) => {
              e.preventDefault()
              setIsResizing(true)
            }}
          >
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
              <GripVertical className="h-4 w-4 text-muted-foreground/50" />
            </div>
          </div>

          {/* Header */}
          <SheetHeader className="px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <SheetTitle className="text-base">
                  {getResourceTitle()} Details
                </SheetTitle>
                <SheetDescription className="text-xs mt-1">
                  {resource?.namespace}/{resource?.name}
                </SheetDescription>
              </div>
              
              {/* Navigation controls */}
              {(onNext || onPrevious) && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {currentIndex} of {totalCount}
                  </span>
                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={onPrevious}
                      disabled={!hasPrevious}
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                      onClick={onNext}
                      disabled={!hasNext}
                    >
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </SheetHeader>

          {/* Content */}
          <div className="flex-1 overflow-auto">
            {renderResourceDetails()}
          </div>
        </SheetContent>
      </Sheet>

      {/* Resize overlay when dragging */}
      {isResizing && createPortal(
        <div className="fixed inset-0 z-50 cursor-col-resize" />,
        document.body
      )}
    </>
  )
}
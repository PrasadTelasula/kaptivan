import React from 'react'
import { 
  Settings, 
  Eye, 
  EyeOff, 
  Clock, 
  BarChart3, 
  Globe, 
  Package, 
  Box,
  Hash
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

export interface DisplaySettings {
  showCluster: boolean
  showPod: boolean
  showContainer: boolean
  showTimestamp: boolean
  showLevel: boolean
  showLineNumbers: boolean
}

interface LogDisplaySettingsProps {
  settings: DisplaySettings
  onSettingsChange: (settings: DisplaySettings) => void
}

export const LogDisplaySettings: React.FC<LogDisplaySettingsProps> = ({
  settings,
  onSettingsChange,
}) => {
  const handleToggle = (key: keyof DisplaySettings) => {
    onSettingsChange({
      ...settings,
      [key]: !settings[key],
    })
  }

  const displayItems = [
    { key: 'showTimestamp', label: 'Timestamp', Icon: Clock },
    { key: 'showLevel', label: 'Log Level', Icon: BarChart3 },
    { key: 'showCluster', label: 'Cluster Name', Icon: Globe },
    { key: 'showPod', label: 'Pod Name', Icon: Package },
    { key: 'showContainer', label: 'Container Name', Icon: Box },
    { key: 'showLineNumbers', label: 'Line Numbers', Icon: Hash },
  ] as const

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Settings className="h-4 w-4" />
          Display Settings
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Log Display Settings</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const allOn = displayItems.every(item => settings[item.key])
                const newState = !allOn
                onSettingsChange({
                  showCluster: newState,
                  showPod: newState,
                  showContainer: newState,
                  showTimestamp: newState,
                  showLevel: newState,
                  showLineNumbers: newState,
                })
              }}
              className="h-7 text-xs"
            >
              {displayItems.every(item => settings[item.key]) ? (
                <>
                  <EyeOff className="h-3 w-3 mr-1" />
                  Hide All
                </>
              ) : (
                <>
                  <Eye className="h-3 w-3 mr-1" />
                  Show All
                </>
              )}
            </Button>
          </div>
          
          <Separator />
          
          <div className="space-y-3">
            {displayItems.map((item) => {
              const IconComponent = item.Icon
              return (
                <div key={item.key} className="flex items-center justify-between">
                  <Label
                    htmlFor={item.key}
                    className="text-sm font-normal cursor-pointer flex items-center gap-2"
                  >
                    <IconComponent className="h-4 w-4 text-muted-foreground" />
                    {item.label}
                  </Label>
                  <Switch
                    id={item.key}
                    checked={settings[item.key]}
                    onCheckedChange={() => handleToggle(item.key)}
                  />
                </div>
              )
            })}
          </div>
          
          <Separator />
          
          <div className="text-xs text-muted-foreground">
            <p>Toggle visibility of different log entry components.</p>
            <p className="mt-1">Changes are applied immediately.</p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
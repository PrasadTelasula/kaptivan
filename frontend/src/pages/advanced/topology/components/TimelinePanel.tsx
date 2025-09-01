import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Clock, 
  ChevronUp, 
  ChevronDown,
  Zap,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Settings2,
  Activity,
  Filter,
  Loader2,
  Info,
  TrendingUp,
  TrendingDown,
  Server,
  AlertTriangle,
  History,
  Rocket,
  RotateCw,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface TimelineEvent {
  id: string;
  timestamp: number;
  type: 'deployment' | 'scale' | 'crash' | 'restart' | 'config_change' | 'error' | 'warning' | 'success' | 'deletion';
  resourceType: string;
  resourceName: string;
  namespace: string;
  message: string;
  severity: 'critical' | 'warning' | 'info' | 'success';
  correlatedEvents?: string[];
}

interface TimelinePanelProps {
  context: string;
  namespace: string;
  resourceName?: string;
  resourceType?: string;
  onTimeChange?: (timestamp: number) => void;
  onEventSelect?: (event: TimelineEvent) => void;
}

export const TimelinePanel: React.FC<TimelinePanelProps> = ({
  context,
  namespace,
  resourceName,
  resourceType,
  onTimeChange,
  onEventSelect
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [timeRange, setTimeRange] = useState({ start: Date.now() - 3600000, end: Date.now() }); // Last hour
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<TimelineEvent | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventError, setEventError] = useState<string | null>(null);
  const [eventTypeFilter, setEventTypeFilter] = useState<string[]>(['deployment', 'scale', 'crash', 'restart', 'config_change', 'error', 'warning', 'success', 'deletion']);
  const [wsConnected, setWsConnected] = useState(false);
  const [snapshot, setSnapshot] = useState<any>(null);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const playbackInterval = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch real events from cluster
  useEffect(() => {
    if (!context || !namespace) {
      return;
    }

    const fetchEvents = async () => {
      setLoadingEvents(true);
      setEventError(null);
      
      try {
        // Build query parameters
        const params = new URLSearchParams({
          context,
          namespace,
          hours: '24', // Last 24 hours
        });
        
        if (resourceName) {
          params.append('resourceName', resourceName);
        }
        if (resourceType) {
          params.append('resourceType', resourceType);
        }

        const response = await fetch(`/api/v1/events/timeline?${params}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch events: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.events && data.events.length > 0) {
          setEvents(data.events);
          
          // Set time range based on actual events
          const timestamps = data.events.map((e: TimelineEvent) => e.timestamp);
          const minTime = Math.min(...timestamps);
          const maxTime = Math.max(...timestamps);
          
          setTimeRange({
            start: minTime - 600000, // Add 10 minutes padding
            end: maxTime + 600000
          });
          setCurrentTime(minTime);
        } else {
          // No events found, use default time range
          setEvents([]);
          setTimeRange({
            start: Date.now() - 3600000, // Last hour
            end: Date.now()
          });
          setCurrentTime(Date.now() - 3600000);
        }
      } catch (error) {
        console.error('Error fetching timeline events:', error);
        setEventError(error instanceof Error ? error.message : 'Failed to fetch events');
        
        // Set default time range on error
        setTimeRange({
          start: Date.now() - 3600000,
          end: Date.now()
        });
        setCurrentTime(Date.now() - 3600000);
      } finally {
        setLoadingEvents(false);
      }
    };

    fetchEvents();
    
    // Refresh events every 30 seconds
    const refreshInterval = setInterval(fetchEvents, 30000);
    
    // Setup WebSocket for real-time updates
    const params = new URLSearchParams({
      context,
      namespace,
      ...(resourceName && { resourceName }),
      ...(resourceType && { resourceType })
    });
    
    const wsUrl = `ws://localhost:8080/api/v1/events/ws?${params}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    
    ws.onopen = () => {
      console.log('WebSocket connected for event stream');
      setWsConnected(true);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'event' && data.event) {
          // Add or update event in the list
          setEvents(prev => {
            const existing = prev.findIndex(e => e.id === data.event.id);
            if (existing >= 0) {
              // Update existing event
              const updated = [...prev];
              updated[existing] = data.event;
              return updated;
            } else {
              // Add new event
              return [...prev, data.event].sort((a, b) => a.timestamp - b.timestamp);
            }
          });
          
          // Update time range if needed
          if (data.event.timestamp) {
            setTimeRange(prev => ({
              start: Math.min(prev.start, data.event.timestamp - 600000),
              end: Math.max(prev.end, data.event.timestamp + 600000)
            }));
          }
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setWsConnected(false);
    };
    
    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setWsConnected(false);
    };
    
    return () => {
      clearInterval(refreshInterval);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [context, namespace, resourceName, resourceType]);

  // Playback control
  useEffect(() => {
    if (isPlaying) {
      playbackInterval.current = setInterval(() => {
        setCurrentTime((prev) => {
          const next = prev + (100 * playbackSpeed);
          if (next >= timeRange.end) {
            setIsPlaying(false);
            return timeRange.end;
          }
          return next;
        });
      }, 100);
    } else if (playbackInterval.current) {
      clearInterval(playbackInterval.current);
    }

    return () => {
      if (playbackInterval.current) {
        clearInterval(playbackInterval.current);
      }
    };
  }, [isPlaying, playbackSpeed, timeRange.end]);

  // Notify parent of time changes
  useEffect(() => {
    onTimeChange?.(currentTime);
  }, [currentTime, onTimeChange]);

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const skipToStart = () => {
    setCurrentTime(timeRange.start);
    setIsPlaying(false);
  };

  const skipToEnd = () => {
    setCurrentTime(timeRange.end);
    setIsPlaying(false);
  };

  const handleSliderChange = (value: number[]) => {
    setCurrentTime(value[0]);
    if (isPlaying) {
      setIsPlaying(false);
    }
  };
  
  // Fetch snapshot for selected time
  const fetchSnapshot = async (timestamp: number) => {
    setLoadingSnapshot(true);
    try {
      const params = new URLSearchParams({
        context,
        namespace,
        timestamp: timestamp.toString(),
        ...(resourceName && { resourceName }),
        ...(resourceType && { resourceType })
      });
      
      const response = await fetch(`/api/v1/events/snapshots?${params}`);
      if (response.ok) {
        const data = await response.json();
        setSnapshot(data.snapshot);
      }
    } catch (error) {
      console.error('Error fetching snapshot:', error);
    } finally {
      setLoadingSnapshot(false);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const formatRelativeTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m ago`;
    return `${minutes}m ago`;
  };

  const getEventIcon = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'deployment': return <Rocket className="h-4 w-4" />;
      case 'scale': return <TrendingUp className="h-4 w-4" />;
      case 'crash': return <XCircle className="h-4 w-4" />;
      case 'restart': return <RotateCw className="h-4 w-4" />;
      case 'config_change': return <Settings2 className="h-4 w-4" />;
      case 'error': return <AlertCircle className="h-4 w-4" />;
      case 'warning': return <AlertTriangle className="h-4 w-4" />;
      case 'success': return <CheckCircle className="h-4 w-4" />;
      case 'deletion': return <Trash2 className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getEventColor = (severity: TimelineEvent['severity']) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'warning': return 'bg-yellow-500';
      case 'success': return 'bg-green-500';
      case 'info': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getEventLabel = (type: TimelineEvent['type']) => {
    switch (type) {
      case 'deployment': return 'New Version Deployed';
      case 'scale': return 'Scaled Up/Down';
      case 'crash': return 'Application Crashed';
      case 'restart': return 'Application Restarted';
      case 'config_change': return 'Configuration Updated';
      case 'error': return 'Error Occurred';
      case 'warning': return 'Warning';
      case 'success': return 'Operation Successful';
      case 'deletion': return 'Pod/Container Deleted';
      default: return 'Event';
    }
  };

  const getSeverityLabel = (severity: TimelineEvent['severity']) => {
    switch (severity) {
      case 'critical': return 'Critical Issue';
      case 'warning': return 'Warning';
      case 'success': return 'Success';
      case 'info': return 'Information';
      default: return severity;
    }
  };

  const handleEventClick = (event: TimelineEvent) => {
    setSelectedEvent(event);
    setCurrentTime(event.timestamp);
    onEventSelect?.(event);
    // Fetch snapshot for this event's time
    fetchSnapshot(event.timestamp);
  };

  // Get visible events based on current time and filters
  const filteredEvents = events.filter(e => eventTypeFilter.includes(e.type));
  const visibleEvents = filteredEvents.filter(e => e.timestamp <= currentTime);
  const upcomingEvents = filteredEvents.filter(e => e.timestamp > currentTime).slice(0, 3);
  
  // Toggle event type in filter
  const toggleEventType = (type: string) => {
    setEventTypeFilter(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  return (
    <div className="absolute bottom-0 left-0 right-0 z-40 px-4 pb-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <Card className="bg-background/98 backdrop-blur-xl border-2 shadow-2xl">
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/30 transition-all rounded-t-lg">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <History className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-base">Event Timeline</span>
                      {wsConnected && (
                        <Badge className="bg-green-500/10 text-green-600 border-green-500/30 hover:bg-green-500/20">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-1.5" />
                          LIVE
                        </Badge>
                      )}
                    </div>
                    {!isOpen && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {events.length > 0 
                          ? `${visibleEvents.length} events in the last ${formatRelativeTime(timeRange.start)}`
                          : 'No events in the selected time range'
                        }
                      </p>
                    )}
                  </div>
                </div>
                
                {!isOpen && selectedEvent && (
                  <div className="flex items-center gap-2 ml-4">
                    <div className={cn(
                      "px-3 py-1.5 rounded-full flex items-center gap-2",
                      selectedEvent.severity === 'critical' && "bg-red-100 text-red-700",
                      selectedEvent.severity === 'warning' && "bg-yellow-100 text-yellow-700",
                      selectedEvent.severity === 'success' && "bg-green-100 text-green-700",
                      selectedEvent.severity === 'info' && "bg-blue-100 text-blue-700"
                    )}>
                      {getEventIcon(selectedEvent.type)}
                      <span className="text-sm font-medium">{getEventLabel(selectedEvent.type)}</span>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-3">
                {!isOpen && events.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      {/* Event severity indicators */}
                      {['critical', 'warning', 'success'].map(severity => {
                        const count = visibleEvents.filter(e => e.severity === severity).length;
                        if (count === 0) return null;
                        return (
                          <div key={severity} className="flex items-center gap-1">
                            <div className={cn(
                              "w-2.5 h-2.5 rounded-full",
                              severity === 'critical' && "bg-red-500",
                              severity === 'warning' && "bg-yellow-500",
                              severity === 'success' && "bg-green-500"
                            )} />
                            <span className="text-xs font-medium text-muted-foreground">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                >
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="p-6 pt-2 space-y-6">
              {/* Help Text */}
              {events.length === 0 ? (
                <div className="bg-muted/30 rounded-lg p-4 flex items-start gap-3">
                  <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">No events to display</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Events will appear here as your application runs. Events include deployments, crashes, restarts, and configuration changes.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Simplified Playback Controls */}
                  <div className="bg-muted/10 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">Time Travel</span>
                        <div className="text-xs text-muted-foreground">
                          View how your system changed over time
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant={isPlaying ? "default" : "outline"}
                          className="h-8 px-3"
                          onClick={togglePlayPause}
                        >
                          {isPlaying ? (
                            <>
                              <Pause className="h-3 w-3 mr-1.5" />
                              Pause
                            </>
                          ) : (
                            <>
                              <Play className="h-3 w-3 mr-1.5" />
                              Play
                            </>
                          )}
                        </Button>
                        
                        <Select 
                          value={playbackSpeed.toString()} 
                          onValueChange={(value) => setPlaybackSpeed(parseFloat(value))}
                        >
                          <SelectTrigger className="w-24 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Normal</SelectItem>
                            <SelectItem value="2">2x Fast</SelectItem>
                            <SelectItem value="5">5x Fast</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Current Time Display */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{formatTime(currentTime)}</span>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {formatRelativeTime(currentTime)}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={skipToStart}
                          title="Jump to oldest event"
                        >
                          <SkipBack className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2"
                          onClick={skipToEnd}
                          title="Jump to latest event"
                        >
                          <SkipForward className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Timeline Slider with Better Visual Feedback */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Drag to explore timeline</span>
                        <span>{visibleEvents.length} of {events.length} events shown</span>
                      </div>

                      {/* Timeline Slider with Event Markers */}
                      <div className="relative pb-2">
                        {/* Event Markers with better visibility */}
                        <div className="absolute inset-x-0 -top-8 h-8">
                          {filteredEvents.map((event) => {
                            const position = ((event.timestamp - timeRange.start) / (timeRange.end - timeRange.start)) * 100;
                            const isPassed = event.timestamp <= currentTime;
                            return (
                              <TooltipProvider key={event.id}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      className={cn(
                                        "absolute transform -translate-x-1/2 transition-all",
                                        isPassed ? "opacity-100" : "opacity-40",
                                        selectedEvent?.id === event.id && "scale-125 z-10"
                                      )}
                                      style={{ left: `${position}%` }}
                                      onClick={() => handleEventClick(event)}
                                      onMouseEnter={() => setHoveredEvent(event)}
                                      onMouseLeave={() => setHoveredEvent(null)}
                                    >
                                      <div className="flex flex-col items-center gap-1">
                                        <div 
                                          className={cn(
                                            "w-3 h-3 rounded-full transition-all border-2 border-background",
                                            getEventColor(event.severity),
                                            hoveredEvent?.id === event.id && "ring-2 ring-offset-1 ring-offset-background"
                                          )}
                                        />
                                      </div>
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <div className="space-y-2">
                                      <div className="flex items-center gap-2">
                                        {getEventIcon(event.type)}
                                        <div>
                                          <p className="font-medium text-sm">{getEventLabel(event.type)}</p>
                                          <p className="text-xs text-muted-foreground">{event.resourceName}</p>
                                        </div>
                                      </div>
                                      <p className="text-xs">{event.message}</p>
                                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <span>{formatTime(event.timestamp)}</span>
                                        <Badge variant="outline" className="h-5">
                                          {getSeverityLabel(event.severity)}
                                        </Badge>
                                      </div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          })}
                        </div>

                        {/* Timeline Slider */}
                        <Slider
                          value={[currentTime]}
                          min={timeRange.start}
                          max={timeRange.end}
                          step={1000}
                          onValueChange={handleSliderChange}
                          className="mt-4"
                        />
                        
                        {/* Time range labels */}
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                          <span>{formatTime(timeRange.start)}</span>
                          <span>{formatTime(timeRange.end)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Event List with Better Organization */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold">Recent Events</h3>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="h-8">
                            <Filter className="h-3 w-3 mr-1.5" />
                            Filter
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80">
                          <div className="space-y-3">
                            <div>
                              <p className="text-sm font-medium mb-3">Show Event Types</p>
                              <div className="grid grid-cols-2 gap-3">
                                {[
                                  { value: 'deployment', label: 'Deployments', icon: Rocket, color: 'text-blue-500' },
                                  { value: 'scale', label: 'Scaling', icon: TrendingUp, color: 'text-purple-500' },
                                  { value: 'crash', label: 'Crashes', icon: XCircle, color: 'text-red-500' },
                                  { value: 'restart', label: 'Restarts', icon: RotateCw, color: 'text-orange-500' },
                                  { value: 'deletion', label: 'Deletions', icon: Trash2, color: 'text-gray-500' },
                                  { value: 'config_change', label: 'Config Changes', icon: Settings2, color: 'text-indigo-500' },
                                  { value: 'error', label: 'Errors', icon: AlertCircle, color: 'text-red-600' },
                                  { value: 'warning', label: 'Warnings', icon: AlertTriangle, color: 'text-yellow-500' },
                                  { value: 'success', label: 'Success', icon: CheckCircle, color: 'text-green-500' }
                                ].map(item => {
                                  const Icon = item.icon;
                                  return (
                                    <div key={item.value} className="flex items-center space-x-2">
                                      <Checkbox
                                        id={item.value}
                                        checked={eventTypeFilter.includes(item.value)}
                                        onCheckedChange={() => toggleEventType(item.value)}
                                      />
                                      <label
                                        htmlFor={item.value}
                                        className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-2 cursor-pointer flex-1"
                                      >
                                        <Icon className={cn("h-4 w-4", item.color)} />
                                        <span>{item.label}</span>
                                      </label>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    
                    {/* Events List */}
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {visibleEvents.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No events yet at this time</p>
                        </div>
                      ) : (
                        visibleEvents.slice(-10).reverse().map((event) => (
                          <div
                            key={event.id}
                            className={cn(
                              "p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm",
                              selectedEvent?.id === event.id 
                                ? "bg-primary/5 border-primary/30" 
                                : "bg-background hover:bg-muted/30"
                            )}
                            onClick={() => handleEventClick(event)}
                          >
                            <div className="flex items-start gap-3">
                              <div className={cn(
                                "p-1.5 rounded-full",
                                event.type === 'deletion' && "bg-gray-100",
                                event.severity === 'critical' && "bg-red-100",
                                event.severity === 'warning' && "bg-yellow-100",
                                event.severity === 'success' && "bg-green-100",
                                event.severity === 'info' && "bg-blue-100"
                              )}>
                                {getEventIcon(event.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="font-medium text-sm">{getEventLabel(event.type)}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {event.resourceName}
                                    </p>
                                  </div>
                                  <Badge 
                                    variant="outline"
                                    className={cn(
                                      "text-xs shrink-0",
                                      event.severity === 'critical' && "border-red-500 text-red-600",
                                      event.severity === 'warning' && "border-yellow-500 text-yellow-600",
                                      event.severity === 'success' && "border-green-500 text-green-600"
                                    )}
                                  >
                                    {getSeverityLabel(event.severity)}
                                  </Badge>
                                </div>
                                <p className="text-xs mt-1.5 text-muted-foreground line-clamp-2">
                                  {event.message}
                                </p>
                                <div className="flex items-center gap-3 mt-2">
                                  <span className="text-xs text-muted-foreground">
                                    {formatTime(event.timestamp)}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    • {formatRelativeTime(event.timestamp)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  
                  {/* Selected Event Details (if clicked) */}
                  {selectedEvent && (
                    <div className="mt-4 p-4 bg-muted/20 rounded-lg border">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "p-1.5 rounded-full",
                              selectedEvent.severity === 'critical' && "bg-red-100",
                              selectedEvent.severity === 'warning' && "bg-yellow-100",
                              selectedEvent.severity === 'success' && "bg-green-100",
                              selectedEvent.severity === 'info' && "bg-blue-100"
                            )}>
                              {getEventIcon(selectedEvent.type)}
                            </div>
                            <div>
                              <p className="font-semibold text-sm">Event Details</p>
                              <p className="text-xs text-muted-foreground">{getEventLabel(selectedEvent.type)}</p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0"
                            onClick={() => setSelectedEvent(null)}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        <div className="space-y-2">
                          <div>
                            <span className="text-xs font-medium text-muted-foreground">Resource:</span>
                            <p className="text-sm mt-0.5">{selectedEvent.resourceName}</p>
                          </div>
                          <div>
                            <span className="text-xs font-medium text-muted-foreground">Message:</span>
                            <p className="text-sm mt-0.5">{selectedEvent.message}</p>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-xs font-medium text-muted-foreground">Time:</span>
                              <p className="text-sm mt-0.5">{formatTime(selectedEvent.timestamp)}</p>
                            </div>
                            <div>
                              <span className="text-xs font-medium text-muted-foreground">Severity:</span>
                              <p className="text-sm mt-0.5">{getSeverityLabel(selectedEvent.severity)}</p>
                            </div>
                          </div>
                          
                          {selectedEvent.correlatedEvents && selectedEvent.correlatedEvents.length > 0 && (
                            <div className="pt-2 border-t">
                              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                <Zap className="h-3 w-3" />
                                Related Events
                              </span>
                              <p className="text-xs text-muted-foreground mt-1">
                                {selectedEvent.correlatedEvents.length} other events occurred around the same time
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
};
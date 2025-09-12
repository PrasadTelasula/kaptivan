import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Search, AlertTriangle, Info, Loader2, Bug, CheckCircle } from 'lucide-react';
import { linterService } from '@/services/linterService';

// Define types locally to avoid Vite caching issues
interface CheckInfo {
  name: string;
  description: string;
  severity: string;
  category: string;
}

interface LintChecksModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LintChecksModal({ isOpen, onClose }: LintChecksModalProps) {
  const [availableChecks, setAvailableChecks] = useState<CheckInfo[]>([]);
  const [customChecks, setCustomChecks] = useState<CheckInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadChecks();
    }
  }, [isOpen]);

  const loadChecks = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [available, custom] = await Promise.all([
        linterService.getAvailableChecks(),
        linterService.getCustomChecks(),
      ]);
      // Ensure we always have arrays
      setAvailableChecks(Array.isArray(available) ? available : []);
      setCustomChecks(Array.isArray(custom) ? custom : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load checks');
      // Set empty arrays on error
      setAvailableChecks([]);
      setCustomChecks([]);
    } finally {
      setIsLoading(false);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return <Shield className="h-4 w-4 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'bg-red-500 text-white';
      case 'warning':
        return 'bg-yellow-500 text-white';
      case 'info':
        return 'bg-blue-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  const filterChecks = (checks: CheckInfo[]) => {
    // Ensure checks is an array
    if (!Array.isArray(checks)) return [];
    if (!searchQuery.trim()) return checks;
    
    const query = searchQuery.toLowerCase();
    return checks.filter(check => 
      check.name.toLowerCase().includes(query) ||
      check.description.toLowerCase().includes(query) ||
      check.category.toLowerCase().includes(query)
    );
  };

  const filteredAvailableChecks = filterChecks(availableChecks);
  const filteredCustomChecks = filterChecks(customChecks);

  const CheckItem = ({ check }: { check: CheckInfo }) => (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          {getSeverityIcon(check.severity)}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <CardTitle className="text-sm">{check.name}</CardTitle>
              <Badge 
                variant={check.severity === 'error' ? 'destructive' : 'outline'}
                className={`text-xs ${
                  check.severity === 'warning' 
                    ? 'border-yellow-500 text-yellow-700' 
                    : check.severity === 'info'
                    ? 'border-blue-500 text-blue-700'
                    : ''
                }`}
              >
                {check.severity.toUpperCase()}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {check.category}
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <CardDescription className="text-sm">
          {check.description}
        </CardDescription>
      </CardContent>
    </Card>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Available Lint Checks
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search checks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {isLoading ? (
            <Alert className="border-blue-200 bg-blue-50">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <AlertDescription className="text-blue-800">
                <div className="flex items-center gap-2">
                  <span>Loading available checks...</span>
                </div>
              </AlertDescription>
            </Alert>
          ) : error ? (
            <Alert className="border-red-200 bg-red-50">
              <Bug className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                <div className="space-y-3">
                  <div>
                    <h3 className="font-medium">Error Loading Checks</h3>
                    <p className="text-sm">{error}</p>
                  </div>
                  <Button onClick={loadChecks} size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-100">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Retry
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : (
            <Tabs defaultValue="available" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="available">
                  Available Checks ({Array.isArray(filteredAvailableChecks) ? filteredAvailableChecks.length : 0})
                </TabsTrigger>
                <TabsTrigger value="custom">
                  Custom Checks ({Array.isArray(filteredCustomChecks) ? filteredCustomChecks.length : 0})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="available" className="mt-4">
                <ScrollArea className="max-h-96">
                  <div className="space-y-3">
                    {!Array.isArray(filteredAvailableChecks) || filteredAvailableChecks.length === 0 ? (
                      <Alert className="border-gray-200 bg-gray-50">
                        <Info className="h-4 w-4 text-gray-600" />
                        <AlertDescription className="text-gray-800">
                          <div className="text-center py-4">
                            <p className="font-medium">No available checks found</p>
                            <p className="text-sm">Try adjusting your search query</p>
                          </div>
                        </AlertDescription>
                      </Alert>
                    ) : (
                      Array.isArray(filteredAvailableChecks) && filteredAvailableChecks.map((check, index) => (
                        <CheckItem key={index} check={check} />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
              
              <TabsContent value="custom" className="mt-4">
                <ScrollArea className="max-h-96">
                  <div className="space-y-3">
                    {!Array.isArray(filteredCustomChecks) || filteredCustomChecks.length === 0 ? (
                      <Alert className="border-gray-200 bg-gray-50">
                        <Info className="h-4 w-4 text-gray-600" />
                        <AlertDescription className="text-gray-800">
                          <div className="text-center py-4">
                            <p className="font-medium">No custom checks found</p>
                            <p className="text-sm">Custom checks will appear here when added</p>
                          </div>
                        </AlertDescription>
                      </Alert>
                    ) : (
                      Array.isArray(filteredCustomChecks) && filteredCustomChecks.map((check, index) => (
                        <CheckItem key={index} check={check} />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

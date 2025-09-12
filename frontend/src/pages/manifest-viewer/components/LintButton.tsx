import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Shield, Loader2, Bug } from 'lucide-react';
import { linterService } from '@/services/linterService';
import { LintResultsModal } from './LintResultsModal';

// Define types locally to avoid Vite caching issues
interface LintResult {
  check: string;
  severity: string;
  message: string;
  remediation: string;
  object: string;
  line: number;
  column: number;
}

interface LintButtonProps {
  yaml: string;
  namespace?: string;
  kind?: string;
  resourceName?: string;
  onResults?: (results: LintResult[]) => void;
  className?: string;
}

export function LintButton({ yaml, namespace, kind, resourceName, onResults, className }: LintButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<LintResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const handleLint = async () => {
    if (!yaml.trim()) {
      setError('No YAML content to lint');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await linterService.lintManifest({ yaml, namespace, kind });
      setResults(response.results);
      onResults?.(response.results);
      setShowModal(true); // Open modal after getting results
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Linting failed');
    } finally {
      setIsLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'bg-red-500 text-white hover:bg-red-600';
      case 'warning':
        return 'bg-yellow-500 text-white hover:bg-yellow-600';
      case 'info':
        return 'bg-blue-500 text-white hover:bg-blue-600';
      default:
        return 'bg-gray-500 text-white hover:bg-gray-600';
    }
  };

  const getOverallSeverity = () => {
    if (!results || !Array.isArray(results)) return 'none';
    if (results.some(r => r.severity === 'error')) return 'error';
    if (results.some(r => r.severity === 'warning')) return 'warning';
    if (results.some(r => r.severity === 'info')) return 'info';
    return 'none';
  };

  const overallSeverity = getOverallSeverity();

  return (
    <TooltipProvider>
      <div className={`relative ${className}`}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLint}
              disabled={isLoading || !yaml.trim()}
              className="h-7 w-7"
              title="Lint manifest for best practices and security issues"
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-purple-500 dark:text-purple-400" />
              ) : (
                <Shield className="h-3.5 w-3.5 text-purple-500 dark:text-purple-400" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Lint manifest for best practices and security issues</p>
          </TooltipContent>
        </Tooltip>

        {results && Array.isArray(results) && results.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className={`absolute -top-1 -right-1 h-4 w-4 p-0 text-xs cursor-pointer ${getSeverityColor(overallSeverity)}`}
                onClick={() => setShowModal(true)}
              >
                {results.length}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                <p className="font-medium">Lint Results</p>
                <div className="text-xs space-y-1">
                  {results && results.filter(r => r.severity === 'error').length > 0 && (
                    <p className="text-red-400">• {results.filter(r => r.severity === 'error').length} errors</p>
                  )}
                  {results && results.filter(r => r.severity === 'warning').length > 0 && (
                    <p className="text-yellow-400">• {results.filter(r => r.severity === 'warning').length} warnings</p>
                  )}
                  {results && results.filter(r => r.severity === 'info').length > 0 && (
                    <p className="text-blue-400">• {results.filter(r => r.severity === 'info').length} info</p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Click to view details</p>
              </div>
            </TooltipContent>
          </Tooltip>
        )}

        {error && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 flex items-center justify-center">
                <Bug className="h-2 w-2 text-white" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">{error}</p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Results Modal */}
        <LintResultsModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          results={results || []}
          manifestName={resourceName || kind}
          manifestKind={kind}
        />
      </div>
    </TooltipProvider>
  );
}
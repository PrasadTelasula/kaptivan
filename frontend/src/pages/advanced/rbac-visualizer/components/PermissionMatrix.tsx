import React, { useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Permission } from '../types';
import { CheckCircle2, XCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface PermissionMatrixProps {
  permissions: Permission[];
  onSubjectClick?: (subject: string) => void;
  onRoleClick?: (role: string) => void;
}

export default function PermissionMatrix({
  permissions,
  onSubjectClick,
  onRoleClick,
}: PermissionMatrixProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const columnsPerPage = 8;
  
  // Group permissions by subject and resource
  const matrix = useMemo(() => {
    const grouped = new Map<string, Map<string, Set<string>>>();
    
    if (!permissions || !Array.isArray(permissions)) {
      return grouped;
    }
    
    permissions.forEach((perm) => {
      if (!grouped.has(perm.subject)) {
        grouped.set(perm.subject, new Map());
      }
      
      const subjectPerms = grouped.get(perm.subject)!;
      
      if (perm.resources && Array.isArray(perm.resources)) {
        perm.resources.forEach((resource) => {
          if (!subjectPerms.has(resource)) {
            subjectPerms.set(resource, new Set());
          }
          if (perm.verbs && Array.isArray(perm.verbs)) {
            perm.verbs.forEach((verb) => {
              subjectPerms.get(resource)!.add(verb);
            });
          }
        });
      }
    });
    
    return grouped;
  }, [permissions]);

  // Get all unique resources
  const allResources = useMemo(() => {
    const resources = new Set<string>();
    if (permissions && Array.isArray(permissions)) {
      permissions.forEach((perm) => {
        if (perm.resources && Array.isArray(perm.resources)) {
          perm.resources.forEach((resource) => resources.add(resource));
        }
      });
    }
    return Array.from(resources).sort();
  }, [permissions]);

  // Filter resources based on search
  const filteredResources = useMemo(() => {
    if (!searchTerm) return allResources;
    return allResources.filter(resource => 
      resource.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allResources, searchTerm]);

  // Calculate pagination
  const totalPages = Math.ceil(filteredResources.length / columnsPerPage);
  const startIdx = currentPage * columnsPerPage;
  const endIdx = Math.min(startIdx + columnsPerPage, filteredResources.length);
  const visibleResources = filteredResources.slice(startIdx, endIdx);

  // Common verbs to check
  const commonVerbs = ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete'];

  const getVerbBadgeVariant = (verb: string) => {
    if (['get', 'list', 'watch'].includes(verb)) return 'secondary';
    if (['create', 'update', 'patch'].includes(verb)) return 'default';
    if (verb === 'delete') return 'destructive';
    return 'outline';
  };

  return (
    <Card className="w-full h-full overflow-hidden flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Permission Matrix</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search resources..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(0);
                }}
                className="pl-8 h-8 w-[200px]"
              />
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm px-2">
                {startIdx + 1}-{endIdx} of {filteredResources.length}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                disabled={currentPage >= totalPages - 1}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="relative">
            <Table>
              <TableHeader className="sticky top-0 z-20 bg-background">
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-30 w-[180px] min-w-[180px]">
                    <div className="pr-2">Subject</div>
                  </TableHead>
                  {visibleResources.map((resource) => (
                    <TableHead key={resource} className="text-center min-w-[140px] px-2">
                      <div className="font-mono text-xs" title={resource}>
                        {resource.length > 20 ? resource.substring(0, 20) + '...' : resource}
                      </div>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from(matrix.entries()).map(([subject, resources]) => (
                  <TableRow key={subject}>
                    <TableCell className="sticky left-0 bg-background z-10 font-medium w-[180px] min-w-[180px]">
                      <button
                        onClick={() => onSubjectClick?.(subject)}
                        className="text-left hover:text-primary transition-colors w-full"
                      >
                        <div className="flex flex-col">
                          <span className="text-sm truncate">{subject.split(':')[1] || subject}</span>
                          <span className="text-xs text-muted-foreground truncate">
                            {subject.split(':')[0]}
                          </span>
                        </div>
                      </button>
                    </TableCell>
                    {visibleResources.map((resource) => (
                      <TableCell key={resource} className="text-center px-2">
                        {resources.has(resource) ? (
                          <div className="flex flex-col gap-0.5 items-center">
                            {Array.from(resources.get(resource)!).slice(0, 3).map((verb) => (
                              <Badge
                                key={verb}
                                variant={getVerbBadgeVariant(verb)}
                                className="text-[10px] px-1 py-0 h-4"
                              >
                                {verb}
                              </Badge>
                            ))}
                            {resources.get(resource)!.size > 3 && (
                              <span className="text-[10px] text-muted-foreground">
                                +{resources.get(resource)!.size - 3}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-300">•</span>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
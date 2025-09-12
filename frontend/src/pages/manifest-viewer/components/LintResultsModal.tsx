import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertTriangle, CheckCircle, Info, Copy, Download, X, FileText, Calendar, Clock, Shield, AlertCircle, ChevronDown, FileJson, FileSpreadsheet, Printer } from 'lucide-react';
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

interface LintResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  results: LintResult[];
  manifestName?: string;
  manifestKind?: string;
}

export function LintResultsModal({
  isOpen,
  onClose,
  results,
  manifestName,
  manifestKind
}: LintResultsModalProps) {
  // Animation states
  const [isVisible, setIsVisible] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Handle modal animations
  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      // Delay content animation for smoother entrance
      const timer = setTimeout(() => setShowContent(true), 100);
      return () => clearTimeout(timer);
    } else {
      setShowContent(false);
      // Delay visibility change for exit animation
      const timer = setTimeout(() => setIsVisible(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Force black background using DOM manipulation
  useEffect(() => {
    if (isOpen) {
      const forceBlackBackground = () => {
        // Check if dark mode is active
        const isDarkMode = document.documentElement.classList.contains('dark');
        
        if (isDarkMode) {
          // Find all dialog elements and force black background in dark mode
          const dialogElements = document.querySelectorAll('[data-radix-dialog-content]');
          dialogElements.forEach(element => {
            (element as HTMLElement).style.setProperty('background-color', '#000000', 'important');
            (element as HTMLElement).style.setProperty('background', '#000000', 'important');
          });

          // Find all child elements and force black background in dark mode
          const childElements = document.querySelectorAll('[data-radix-dialog-content] > div');
          childElements.forEach(element => {
            (element as HTMLElement).style.setProperty('background-color', '#000000', 'important');
            (element as HTMLElement).style.setProperty('background', '#000000', 'important');
          });

          // Find elements with our custom class
          const customElements = document.querySelectorAll('.lint-modal-dialog');
          customElements.forEach(element => {
            (element as HTMLElement).style.setProperty('background-color', '#000000', 'important');
            (element as HTMLElement).style.setProperty('background', '#000000', 'important');
          });
        } else {
          // Force white background in light mode
          const dialogElements = document.querySelectorAll('[data-radix-dialog-content]');
          dialogElements.forEach(element => {
            (element as HTMLElement).style.setProperty('background-color', '#ffffff', 'important');
            (element as HTMLElement).style.setProperty('background', '#ffffff', 'important');
          });

          const childElements = document.querySelectorAll('[data-radix-dialog-content] > div');
          childElements.forEach(element => {
            (element as HTMLElement).style.setProperty('background-color', '#ffffff', 'important');
            (element as HTMLElement).style.setProperty('background', '#ffffff', 'important');
          });

          const customElements = document.querySelectorAll('.lint-modal-dialog');
          customElements.forEach(element => {
            (element as HTMLElement).style.setProperty('background-color', '#ffffff', 'important');
            (element as HTMLElement).style.setProperty('background', '#ffffff', 'important');
          });
        }
      };

      // Apply immediately
      forceBlackBackground();

      // Apply after a short delay to catch any dynamically created elements
      setTimeout(forceBlackBackground, 100);
      setTimeout(forceBlackBackground, 500);

      // Use MutationObserver to catch any dynamically created elements
      const observer = new MutationObserver(() => {
        forceBlackBackground();
      });

      // Start observing
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style']
      });

      // Cleanup
      return () => {
        observer.disconnect();
      };
    }
  }, [isOpen]);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-600" />;
      default:
        return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800';
      case 'warning':
        return 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800';
      case 'info':
        return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800';
      default:
        return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800';
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Export functions
  const getFileName = (format: string) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const name = manifestName || 'manifest';
    const kind = manifestKind || 'Unknown';
    return `security-analysis-${kind}-${name}-${timestamp}.${format}`;
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    try {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      
      // Create a temporary anchor element
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      
      // Add to DOM, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the URL
      setTimeout(() => URL.revokeObjectURL(url), 100);
      
      return true;
    } catch (error) {
      console.error('Download failed:', error);
      return false;
    }
  };

  const showExportFeedback = (success: boolean, format: string) => {
    if (success) {
      console.log(`✅ ${format} export completed successfully`);
      // You could add a toast notification here
    } else {
      console.error(`❌ ${format} export failed`);
      alert(`Failed to export ${format}. Please try again.`);
    }
  };

  const exportToJSON = async () => {
    if (isExporting) return;
    
    setIsExporting(true);
    try {
      const exportData = {
        manifest: {
          name: manifestName || 'unknown',
          kind: manifestKind || 'unknown',
          fullName: manifestKind && manifestName ? `${manifestKind}/${manifestName}` : 'Unknown',
          analyzedAt: new Date().toISOString()
        },
        summary: {
          totalIssues: results.length,
          errors: counts.error,
          warnings: counts.warning,
          info: counts.info
        },
        results: results || []
      };

      const content = JSON.stringify(exportData, null, 2);
      const filename = getFileName('json');
      const success = downloadFile(content, filename, 'application/json');
      showExportFeedback(success, 'JSON');
    } catch (error) {
      console.error('JSON export error:', error);
      showExportFeedback(false, 'JSON');
    } finally {
      setIsExporting(false);
    }
  };

  const exportToCSV = async () => {
    if (isExporting) return;
    
    setIsExporting(true);
    try {
      const headers = ['Check', 'Severity', 'Message', 'Remediation', 'Object', 'Line', 'Column'];
      const csvContent = [
        headers.join(','),
        ...(results || []).map(result => [
          `"${(result.check || '').replace(/"/g, '""')}"`,
          `"${(result.severity || '').replace(/"/g, '""')}"`,
          `"${(result.message || '').replace(/"/g, '""')}"`,
          `"${(result.remediation || '').replace(/"/g, '""')}"`,
          `"${(result.object || '').replace(/"/g, '""')}"`,
          result.line || 0,
          result.column || 0
        ].join(','))
      ].join('\n');

      const filename = getFileName('csv');
      const success = downloadFile(csvContent, filename, 'text/csv');
      showExportFeedback(success, 'CSV');
    } catch (error) {
      console.error('CSV export error:', error);
      showExportFeedback(false, 'CSV');
    } finally {
      setIsExporting(false);
    }
  };

  const exportToHTML = async () => {
    if (isExporting) return;
    
    setIsExporting(true);
    try {
      const safeResults = results || [];
      const safeManifestName = manifestName || 'unknown';
      const safeManifestKind = manifestKind || 'unknown';
      
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Security Analysis Report - ${safeManifestName}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
        .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
        .summary-item { text-align: center; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
        .summary-number { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
        .summary-label { color: #666; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f5f5f5; font-weight: bold; }
        .severity-error { color: #dc2626; }
        .severity-warning { color: #d97706; }
        .severity-info { color: #2563eb; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Security Analysis Report</h1>
        <p><strong>Manifest:</strong> ${safeManifestKind}/${safeManifestName}</p>
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
    </div>
    
    <div class="summary">
        <div class="summary-item">
            <div class="summary-number">${safeResults.length}</div>
            <div class="summary-label">Total Issues</div>
        </div>
        <div class="summary-item">
            <div class="summary-number severity-error">${counts.error}</div>
            <div class="summary-label">Critical</div>
        </div>
        <div class="summary-item">
            <div class="summary-number severity-warning">${counts.warning}</div>
            <div class="summary-label">Warnings</div>
        </div>
        <div class="summary-item">
            <div class="summary-number severity-info">${counts.info}</div>
            <div class="summary-label">Info</div>
        </div>
    </div>

    <h2>Detailed Findings</h2>
    <table>
        <thead>
            <tr>
                <th>Check</th>
                <th>Severity</th>
                <th>Message</th>
                <th>Remediation</th>
                <th>Object</th>
                <th>Line</th>
                <th>Column</th>
            </tr>
        </thead>
        <tbody>
            ${safeResults.map(result => `
                <tr>
                    <td>${(result.check || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
                    <td class="severity-${result.severity || 'info'}">${(result.severity || 'info').toUpperCase()}</td>
                    <td>${(result.message || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
                    <td>${(result.remediation || 'N/A').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
                    <td>${(result.object || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
                    <td>${result.line || 0}</td>
                    <td>${result.column || 0}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>

    <div class="footer">
        <p>Generated by Kaptivan Security Analysis • ${new Date().toLocaleString()}</p>
    </div>
</body>
</html>`;

      const filename = getFileName('html');
      const success = downloadFile(htmlContent, filename, 'text/html');
      showExportFeedback(success, 'HTML');
    } catch (error) {
      console.error('HTML export error:', error);
      showExportFeedback(false, 'HTML');
    } finally {
      setIsExporting(false);
    }
  };

  const printReport = async () => {
    if (isExporting) return;
    
    setIsExporting(true);
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Unable to open print window. Please check your browser settings.');
        return;
      }

      const safeResults = results || [];
      const safeManifestName = manifestName || 'unknown';
      const safeManifestKind = manifestKind || 'unknown';

      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Security Analysis Report - ${safeManifestName}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px; }
        .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
        .summary-item { text-align: center; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
        .summary-number { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
        .summary-label { color: #666; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
        th { background-color: #f5f5f5; font-weight: bold; }
        .severity-error { color: #dc2626; }
        .severity-warning { color: #d97706; }
        .severity-info { color: #2563eb; }
        @media print {
            body { margin: 0; }
            .no-print { display: none; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Security Analysis Report</h1>
        <p><strong>Manifest:</strong> ${safeManifestKind}/${safeManifestName}</p>
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
    </div>
    
    <div class="summary">
        <div class="summary-item">
            <div class="summary-number">${safeResults.length}</div>
            <div class="summary-label">Total Issues</div>
        </div>
        <div class="summary-item">
            <div class="summary-number severity-error">${counts.error}</div>
            <div class="summary-label">Critical</div>
        </div>
        <div class="summary-item">
            <div class="summary-number severity-warning">${counts.warning}</div>
            <div class="summary-label">Warnings</div>
        </div>
        <div class="summary-item">
            <div class="summary-number severity-info">${counts.info}</div>
            <div class="summary-label">Info</div>
        </div>
    </div>

    <h2>Detailed Findings</h2>
    <table>
        <thead>
            <tr>
                <th>Check</th>
                <th>Severity</th>
                <th>Message</th>
                <th>Remediation</th>
                <th>Object</th>
                <th>Line</th>
                <th>Column</th>
            </tr>
        </thead>
        <tbody>
            ${safeResults.map(result => `
                <tr>
                    <td>${(result.check || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
                    <td class="severity-${result.severity || 'info'}">${(result.severity || 'info').toUpperCase()}</td>
                    <td>${(result.message || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
                    <td>${(result.remediation || 'N/A').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
                    <td>${(result.object || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
                    <td>${result.line || 0}</td>
                    <td>${result.column || 0}</td>
                </tr>
            `).join('')}
        </tbody>
    </table>
</body>
</html>`;

      printWindow.document.write(htmlContent);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      
      showExportFeedback(true, 'PDF');
    } catch (error) {
      console.error('Print error:', error);
      showExportFeedback(false, 'PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const getSeverityCounts = () => {
    const counts = { error: 0, warning: 0, info: 0 };
    results.forEach(result => {
      if (result.severity in counts) {
        counts[result.severity as keyof typeof counts]++;
      }
    });
    return counts;
  };

  const counts = getSeverityCounts();

  const getResultsBySeverity = (severity: string) => {
    return results.filter(result => result.severity === severity);
  };

  return (
    <>
      <style>
        {`
          /* Base styles */
          .lint-modal-dialog [data-radix-dialog-content] {
            background-color: #ffffff !important;
            background: #ffffff !important;
            animation: modalEnter 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            transform-origin: center;
          }
          .lint-modal-dialog [data-radix-dialog-content] > div {
            background-color: #ffffff !important;
            background: #ffffff !important;
          }
          [data-radix-dialog-content] {
            background-color: #ffffff !important;
            background: #ffffff !important;
            animation: modalEnter 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          }
          [data-radix-dialog-content] > div {
            background-color: #ffffff !important;
            background: #ffffff !important;
          }
          .lint-modal-dialog {
            background-color: #ffffff !important;
            background: #ffffff !important;
          }
          .dark .lint-modal-dialog [data-radix-dialog-content] {
            background-color: #000000 !important;
            background: #000000 !important;
            animation: modalEnter 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .dark .lint-modal-dialog [data-radix-dialog-content] > div {
            background-color: #000000 !important;
            background: #000000 !important;
          }
          .dark [data-radix-dialog-content] {
            background-color: #000000 !important;
            background: #000000 !important;
            animation: modalEnter 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .dark [data-radix-dialog-content] > div {
            background-color: #000000 !important;
            background: #000000 !important;
          }
          .dark .lint-modal-dialog {
            background-color: #000000 !important;
            background: #000000 !important;
          }
          .dark .lint-modal-dialog * {
            background-color: #000000 !important;
            background: #000000 !important;
          }
          .dark .lint-modal-dialog .px-8 {
            background-color: #000000 !important;
            background: #000000 !important;
          }
          .dark .lint-modal-dialog .py-6 {
            background-color: #000000 !important;
            background: #000000 !important;
          }
          .dark .lint-modal-dialog .border-b {
            background-color: #000000 !important;
            background: #000000 !important;
          }

          /* Animation keyframes */
          @keyframes modalEnter {
            from {
              opacity: 0;
              transform: scale(0.95) translateY(-10px);
            }
            to {
              opacity: 1;
              transform: scale(1) translateY(0);
            }
          }

          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes slideInRight {
            from {
              opacity: 0;
              transform: translateX(30px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }

          @keyframes pulse {
            0%, 100% {
              transform: scale(1);
            }
            50% {
              transform: scale(1.05);
            }
          }

          @keyframes bounce {
            0%, 20%, 53%, 80%, 100% {
              transform: translate3d(0,0,0);
            }
            40%, 43% {
              transform: translate3d(0, -8px, 0);
            }
            70% {
              transform: translate3d(0, -4px, 0);
            }
            90% {
              transform: translate3d(0, -2px, 0);
            }
          }

          @keyframes shimmer {
            0% {
              background-position: -200px 0;
            }
            100% {
              background-position: calc(200px + 100%) 0;
            }
          }

          /* Motion classes */
          .animate-fade-in-up {
            animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }

          .animate-slide-in-right {
            animation: slideInRight 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }

          .animate-pulse-gentle {
            animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
          }

          .animate-bounce-gentle {
            animation: bounce 1s ease-in-out;
          }

          .animate-shimmer {
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
            background-size: 200px 100%;
            animation: shimmer 1.5s infinite;
          }

          .stagger-1 { animation-delay: 0.1s; }
          .stagger-2 { animation-delay: 0.2s; }
          .stagger-3 { animation-delay: 0.3s; }
          .stagger-4 { animation-delay: 0.4s; }
          .stagger-5 { animation-delay: 0.5s; }

          /* Hover animations */
          .hover-lift {
            transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .hover-lift:hover {
            transform: translateY(-2px);
          }

          .hover-scale {
            transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .hover-scale:hover {
            transform: scale(1.05);
          }

          .hover-glow {
            transition: box-shadow 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .hover-glow:hover {
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.3);
          }
        `}
      </style>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent 
          className="lint-modal-dialog max-w-6xl h-[90vh] p-0 flex flex-col bg-white dark:!bg-black" 
          style={{ 
            backgroundColor: '#ffffff',
            background: '#ffffff'
          } as React.CSSProperties}
        >
        {/* Professional Header */}
        <DialogHeader className={`px-8 py-6 border-b bg-gray-50 dark:!bg-black flex-shrink-0 ${showContent ? 'animate-fade-in-up' : 'opacity-0'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 bg-gray-200 dark:!bg-black rounded-lg hover-scale ${showContent ? 'animate-bounce-gentle' : 'opacity-0'}`}>
                  <Shield className="h-6 w-6 text-gray-700 dark:text-white" />
                </div>
                <div className={showContent ? 'animate-slide-in-right stagger-1' : 'opacity-0'}>
                  <DialogTitle className="text-2xl font-semibold text-gray-900 dark:text-white">
                    Security Analysis Report
                  </DialogTitle>
                  <DialogDescription className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    Comprehensive security analysis and best practices validation for Kubernetes manifests
                  </DialogDescription>
                  <div className="flex items-center gap-4 mt-2 text-sm text-gray-600 dark:text-gray-300">
                    <div className="flex items-center gap-1">
                      <FileText className="h-4 w-4" />
                      <span>
                        {manifestKind && manifestName ? `${manifestKind}/${manifestName}` : 
                         manifestKind ? `${manifestKind}/Unknown` : 
                         'Manifest Security Check'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>{new Date().toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>{new Date().toLocaleTimeString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className={`flex items-center gap-2 ${showContent ? 'animate-slide-in-right stagger-2' : 'opacity-0'}`}>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={printReport}
                disabled={isExporting}
                className="text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover-lift hover-glow"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Printer className="h-4 w-4 mr-2" />
                )}
                {isExporting ? 'Preparing...' : 'Print PDF'}
              </Button>
            </div>
          </div>
        </DialogHeader>

        {results.length === 0 ? (
          <div className={`px-8 py-16 flex-1 flex items-center justify-center bg-white dark:!bg-black ${showContent ? 'animate-fade-in-up' : 'opacity-0'}`}>
            <div className="text-center max-w-md mx-auto">
              <div className={`w-16 h-16 bg-green-100 dark:!bg-black rounded-full mx-auto mb-6 flex items-center justify-center hover-scale ${showContent ? 'animate-bounce-gentle' : 'opacity-0'}`}>
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className={`text-xl font-semibold text-gray-900 dark:text-white mb-3 ${showContent ? 'animate-fade-in-up stagger-1' : 'opacity-0'}`}>
                No Security Issues Found
              </h3>
              <p className={`text-gray-600 dark:text-gray-300 mb-6 ${showContent ? 'animate-fade-in-up stagger-2' : 'opacity-0'}`}>
                This manifest passes all security checks and follows Kubernetes best practices.
              </p>
              <Button onClick={onClose} className={`bg-green-600 hover:bg-green-700 text-white hover-lift hover-glow ${showContent ? 'animate-fade-in-up stagger-3' : 'opacity-0'}`}>
                Close Report
              </Button>
            </div>
          </div>
        ) : (
          <ScrollArea className="flex-1 bg-white dark:!bg-black">
            <div className="flex flex-col bg-white dark:!bg-black">
              {/* Executive Summary */}
              <div className={`px-8 py-6 border-b bg-gray-50 dark:!bg-black flex-shrink-0 ${showContent ? 'animate-fade-in-up' : 'opacity-0'}`}>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Executive Summary</h3>
                <div className="grid grid-cols-4 gap-6">
                  <div className={`text-center hover-lift ${showContent ? 'animate-fade-in-up stagger-1' : 'opacity-0'}`}>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                      {results.length}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Total Issues</div>
                  </div>
                  <div className={`text-center hover-lift ${showContent ? 'animate-fade-in-up stagger-2' : 'opacity-0'}`}>
                    <div className="text-3xl font-bold text-red-600 dark:text-red-400 mb-1">
                      {counts.error}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Critical</div>
                  </div>
                  <div className={`text-center hover-lift ${showContent ? 'animate-fade-in-up stagger-3' : 'opacity-0'}`}>
                    <div className="text-3xl font-bold text-amber-600 dark:text-amber-400 mb-1">
                      {counts.warning}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Warnings</div>
                  </div>
                  <div className={`text-center hover-lift ${showContent ? 'animate-fade-in-up stagger-4' : 'opacity-0'}`}>
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                      {counts.info}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">Info</div>
                  </div>
                </div>
              </div>

              {/* Detailed Findings */}
              <div className="px-8 py-6 bg-white dark:!bg-black">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Detailed Findings</h3>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:!bg-black">
                  <Table>
                    <TableHeader className="bg-gray-50 dark:!bg-black">
                      <TableRow>
                        <TableHead className="w-16 text-center">Severity</TableHead>
                        <TableHead className="w-48">Check</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="w-24">Location</TableHead>
                        <TableHead className="w-32">Remediation</TableHead>
                        <TableHead className="w-16 text-center">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                            <TableBody>
                              {results.map((result, index) => (
                                <TableRow key={index} className={`border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover-lift ${showContent ? 'animate-fade-in-up' : 'opacity-0'}`} style={{ animationDelay: `${index * 0.1}s` }}>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              {getSeverityIcon(result.severity)}
                              <Badge className={`text-xs ${getSeverityBadge(result.severity)} hover-scale animate-pulse-gentle`}>
                                {result.severity.toUpperCase()}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium text-sm text-gray-900 dark:text-white">
                              {result.check}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm text-gray-700 dark:text-gray-200">
                              {result.message}
                            </div>
                          </TableCell>
                          <TableCell>
                            {result.line && (
                              <div className="text-xs text-gray-500 dark:text-gray-300 font-mono">
                                L{result.line}
                                {result.column && `:C${result.column}`}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {result.remediation ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyToClipboard(result.remediation)}
                              className="text-xs h-7 hover-scale hover-glow"
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Copy
                            </Button>
                            ) : (
                              <span className="text-xs text-gray-400 dark:text-gray-400">N/A</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyToClipboard(result.message)}
                              className="h-8 w-8 p-0 text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white hover-scale hover-glow"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Remediation Details */}
              {results.some(r => r.remediation) && (
                <div className="px-8 py-6 border-t bg-gray-50 dark:!bg-black">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Remediation Details</h3>
                  <div className="space-y-4">
                    {results.filter(r => r.remediation).map((result, index) => (
                      <div key={index} className="bg-white dark:!bg-black border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium text-sm text-gray-900 dark:text-white">
                            {result.check}
                          </h4>
                          <Badge className={`text-xs ${getSeverityBadge(result.severity)}`}>
                            {result.severity.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="bg-gray-50 dark:!bg-black border border-gray-200 dark:border-gray-700 rounded p-3 mt-2">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs font-medium text-gray-700 dark:text-gray-200">Remediation:</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyToClipboard(result.remediation)}
                              className="h-6 px-2 text-xs"
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-300 font-mono">
                            {result.remediation}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {/* Footer */}
        <div className="px-8 py-4 border-t bg-gray-50 dark:!bg-black flex-shrink-0">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-300">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span>Powered by kube-linter</span>
              </div>
              <span>•</span>
              <span>Security Analysis Report</span>
              <span>•</span>
              <span>Generated on {new Date().toLocaleString()}</span>
            </div>
            <div className={`flex gap-2 ${showContent ? 'animate-slide-in-right stagger-3' : 'opacity-0'}`}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={isExporting}
                    className="text-gray-600 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover-lift hover-glow"
                  >
                    {isExporting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    {isExporting ? 'Exporting...' : 'Export'}
                    <ChevronDown className="h-3 w-3 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={printReport} className="cursor-pointer" disabled={isExporting}>
                    <Printer className="h-4 w-4 mr-2" />
                    Print PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportToHTML} className="cursor-pointer" disabled={isExporting}>
                    <FileText className="h-4 w-4 mr-2" />
                    Export HTML
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportToCSV} className="cursor-pointer" disabled={isExporting}>
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    Export CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={exportToJSON} className="cursor-pointer" disabled={isExporting}>
                    <FileJson className="h-4 w-4 mr-2" />
                    Export JSON
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button onClick={onClose} className="bg-gray-900 hover:bg-gray-800 text-white dark:bg-white dark:hover:bg-gray-200 dark:text-black hover-scale">
                Close
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

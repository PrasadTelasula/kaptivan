import type { CompareRow, NamespaceSnapshot } from '../types/index'

export function exportToCSV(
  rows: CompareRow[],
  snapshotA: NamespaceSnapshot,
  snapshotB: NamespaceSnapshot
): void {
  const headers = [
    'Section',
    'Metric',
    `${snapshotA.cluster}/${snapshotA.namespace}`,
    `${snapshotB.cluster}/${snapshotB.namespace}`,
    'Delta',
    'Severity A',
    'Severity B'
  ]

  const csvRows: string[] = []
  csvRows.push(headers.join(','))

  let currentSection = ''
  
  rows.forEach(row => {
    if (row.section !== undefined) {
      currentSection = row.section || ''
      return
    }

    const csvRow = [
      currentSection,
      row.metric,
      row.valueA.toString(),
      row.valueB.toString(),
      row.delta?.toString() || '',
      row.severityA || '',
      row.severityB || ''
    ]

    csvRows.push(csvRow.map(escapeCSV).join(','))
  })

  const csvContent = csvRows.join('\n')
  downloadFile(csvContent, `namespace-comparison-${Date.now()}.csv`, 'text/csv')
}

export function exportToJSON(
  rows: CompareRow[],
  snapshotA: NamespaceSnapshot,
  snapshotB: NamespaceSnapshot
): void {
  const exportData = {
    timestamp: new Date().toISOString(),
    comparison: {
      namespaceA: {
        cluster: snapshotA.cluster,
        namespace: snapshotA.namespace
      },
      namespaceB: {
        cluster: snapshotB.cluster,
        namespace: snapshotB.namespace
      }
    },
    rows: rows.filter(row => row.section === undefined),
    snapshotA,
    snapshotB
  }

  const jsonContent = JSON.stringify(exportData, null, 2)
  downloadFile(jsonContent, `namespace-comparison-${Date.now()}.json`, 'application/json')
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
import { DetailedResourceComparison } from './DetailedResourceComparison'

interface DetailedDifferencesProps {
  selections: Array<{
    cluster: string
    namespace: string
    color: string
  }>
}

export function DetailedDifferences({ selections }: DetailedDifferencesProps) {
  return <DetailedResourceComparison selections={selections} />
}
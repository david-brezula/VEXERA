/**
 * Export Adapter Factory
 *
 * Returns the correct ExportAdapter implementation for a given ExportFormat.
 * Throws if an unsupported format is requested (should not happen in practice
 * because the API validates format with Zod before calling this).
 *
 * Usage:
 *   const adapter = getExportAdapter('pohoda')
 *   const result  = adapter.generate(rows, '2024-01-01', '2024-03-31')
 */

import type { ExportFormat } from '@vexera/types'
import type { ExportAdapter } from './export.adapter'
import { PohodaAdapter } from './pohoda.adapter'
import { MoneyS3Adapter } from './money-s3.adapter'
import { GenericCsvAdapter } from './generic-csv.adapter'

// Re-export types for convenience
export type { ExportAdapter, ExportRow, ExportResult } from './export.adapter'

/**
 * Factory function — returns the ExportAdapter for the requested format.
 * @param format  One of: 'pohoda' | 'money_s3' | 'kros' | 'csv_generic'
 * @throws        Error if format is not supported
 */
export function getExportAdapter(format: ExportFormat): ExportAdapter {
  switch (format) {
    case 'pohoda':
      return new PohodaAdapter()
    case 'money_s3':
      return new MoneyS3Adapter()
    case 'kros':
      // KROS Omega uses a CSV format similar to Money S3 with different column order.
      // For now fall back to generic CSV with a note — implement KrosAdapter when spec is available.
      return new GenericCsvAdapter()
    case 'csv_generic':
      return new GenericCsvAdapter()
    default: {
      const _exhaustive: never = format
      throw new Error(`Unsupported export format: ${String(_exhaustive)}`)
    }
  }
}

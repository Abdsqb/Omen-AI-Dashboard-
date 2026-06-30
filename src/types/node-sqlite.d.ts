/**
 * Type declarations for Node.js 22+ built-in sqlite module.
 * Available from Node 22.5.0+. Stable (no flag needed) from 22.15.0+.
 * https://nodejs.org/api/sqlite.html
 */
declare module 'node:sqlite' {
  type SupportedValue = null | number | bigint | string | Uint8Array

  interface RunResult {
    changes: number
    lastInsertRowid: number | bigint
  }

  interface StatementSync {
    run(...params: SupportedValue[]): RunResult
    get(...params: SupportedValue[]): Record<string, SupportedValue> | undefined
    all(...params: SupportedValue[]): Record<string, SupportedValue>[]
    iterate(...params: SupportedValue[]): Iterator<Record<string, SupportedValue>>
    setAllowBareNamedParameters(enabled: boolean): void
    setReadBigInts(enabled: boolean): void
    readonly sourceSQL: string
    readonly expandedSQL: string
  }

  interface DatabaseSyncOptions {
    open?: boolean
    readOnly?: boolean
    enableForeignKeyConstraints?: boolean
    enableLoadExtension?: boolean
  }

  class DatabaseSync {
    constructor(location: string, options?: DatabaseSyncOptions)
    open(): void
    close(): void
    exec(sql: string): void
    prepare(sql: string): StatementSync
    function(name: string, fn: (...args: SupportedValue[]) => SupportedValue): void
    readonly isOpen: boolean
  }

  export { DatabaseSync, StatementSync, RunResult, SupportedValue, DatabaseSyncOptions }
}

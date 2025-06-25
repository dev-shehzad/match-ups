// Type definitions for os-utils
declare module "os-utils" {
  export function cpuUsage(callback: (value: number) => void): void
  export function cpuFree(callback: (value: number) => void): void
  export function cpuCount(): number
  export function freemem(): number
  export function totalmem(): number
  export function freememPercentage(): number
  export function sysUptime(): number
  export function processUptime(): number
  export function loadavg(time?: number): number
  export function platform(): string
  export function isLinux(): boolean
  export function isWin(): boolean
  export function isMac(): boolean
}

// Also declare the direct path import
declare module "os-utils/lib/osutils.js" {
  import * as osUtils from "os-utils"
  export = osUtils
}

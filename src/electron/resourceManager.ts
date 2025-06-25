// Import createRequire to use require in ESM
import { createRequire } from "module"
const require = createRequire(import.meta.url)
// Now we can use require
const osUtils = require("os-utils")

import os from "os"
import fs from "fs"
import type { BrowserWindow } from "electron"
import { ipcWebContentsSend } from "./util.js"

const POLLING_INTERVAL = 500

export function pollResources(mainWindow: BrowserWindow) {
  let intervalId: NodeJS.Timeout

  const poll = async () => {
    try {
      // Check if window or webContents is destroyed
      if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents || mainWindow.webContents.isDestroyed()) {
        clearInterval(intervalId)
        return
      }

      const cpuUsage = await getCpuUsage()
      const ramUsage = getRamUsage()
      const storageData = getStorageData()

      // Only send if webContents is still valid
      if (!mainWindow.webContents.isDestroyed()) {
        ipcWebContentsSend("statistics", mainWindow.webContents, {
          cpuUsage,
          ramUsage,
          storageUsage: storageData.usage,
        })
      }
    } catch (error) {
      console.error("Error polling resources:", error)
      // Clear interval on error to prevent continuous error messages
      clearInterval(intervalId)
    }
  }

  // Start polling
  intervalId = setInterval(poll, POLLING_INTERVAL)

  // Clean up interval when window is closed
  mainWindow.on("closed", () => {
    clearInterval(intervalId)
  })
}

export function getStaticData() {
  const totalStorage = getStorageData().total
  const cpuModel = os.cpus()[0].model
  const totalMemoryGB = Math.floor(osUtils.totalmem() / 1024)

  return {
    totalStorage,
    cpuModel,
    totalMemoryGB,
  }
}

function getCpuUsage(): Promise<number> {
  return new Promise((resolve) => {
    osUtils.cpuUsage(resolve)
  })
}

function getRamUsage() {
  return 1 - osUtils.freememPercentage()
}

function getStorageData() {
  // requires node 18
  const stats = fs.statfsSync(process.platform === "win32" ? "C://" : "/")
  const total = stats.bsize * stats.blocks
  const free = stats.bsize * stats.bfree

  return {
    total: Math.floor(total / 1_000_000_000),
    usage: 1 - free / total,
  }
}

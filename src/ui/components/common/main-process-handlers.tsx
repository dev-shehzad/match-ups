// This should be in your main.js/main.ts file
import { type BrowserWindow, ipcMain } from "electron"

// Make sure this handler is registered when your app starts
function setupWindowControlHandlers(mainWindow: BrowserWindow) {
  ipcMain.on("window-control", (event, action) => {
    console.log(`Main process: Received window-control action: ${action}`)

    if (!mainWindow) {
      console.error("Main window is not available")
      return
    }

    switch (action) {
      case "minimize":
        console.log("Minimizing window")
        mainWindow.minimize()
        break
      case "maximize":
        console.log("Toggling maximize state")
        if (mainWindow.isMaximized()) {
          mainWindow.unmaximize()
        } else {
          mainWindow.maximize()
        }
        break
      case "close":
        console.log("Closing window")
        mainWindow.close()
        break
      default:
        console.log(`Unknown window control action: ${action}`)
    }
  })
}

// Call this function after creating your main window
// setupWindowControlHandlers(mainWindow);


// Create this file in your project to handle BrowserView-specific preload logic
const { contextBridge, ipcRenderer } = require("electron")

// Expose minimal API to the BrowserView
contextBridge.exposeInMainWorld("streamingAPI", {
  notifyLoaded: () => {
    ipcRenderer.send("streaming-view-loaded", {
      url: window.location.href,
      title: document.title,
    })
  },

  notifyError: (error: { toString: () => any }) => {
    ipcRenderer.send("streaming-view-error", {
      error: error.toString(),
    })
  },
})

// Apply streaming fixes immediately
window.addEventListener("DOMContentLoaded", () => {
  // Fix for video playback issues
  const fixVideoElements = () => {
    const videos = document.querySelectorAll("video")
    videos.forEach((video) => {
      if ((video as any)._streamingFixed) return
      (video as any)._streamingFixed = true
  
      // Store original methods
      const originalPlay = video.play
  
      // Override play method
      video.play = function (...args: any[]) {
        console.log("Enhanced play method called")
        try {
          const result = originalPlay.apply(this, args as any)
          if (result && result.catch) {
            result.catch((err) => {
              console.error("Play error caught:", err)
              // Try again with muted
              this.muted = true
              originalPlay
                .apply(this)
                .then(() => {
                  console.log("Muted play successful")
                  setTimeout(() => {
                    this.muted = false
                  }, 1000)
                })
                .catch((err2) => {
                  console.error("Even muted play failed:", err2)
                })
            })
          }
          return result
        } catch (e) {
          console.error("Error in enhanced play:", e)
          return Promise.reject(e)
        }
      }
  
      // Force autoplay
      video.autoplay = true
    })
  }
  

  // Run immediately and set up observer for future videos
  fixVideoElements()

  const observer = new MutationObserver(() => {
    fixVideoElements()
  })

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  })

  // Notify that the page is loaded
  ipcRenderer.send("streaming-view-loaded", {
    url: window.location.href,
    title: document.title,
  })
})

// Listen for navigation events
window.addEventListener("load", () => {
  ipcRenderer.send("streaming-view-loaded", {
    url: window.location.href,
    title: document.title,
  })
})

// Handle errors
window.addEventListener("error", (event) => {
  ipcRenderer.send("streaming-view-error", {
    error: event.message,
  })
})


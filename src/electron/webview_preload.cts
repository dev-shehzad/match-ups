// src/electron/webview_preload.cjs
const { ipcRenderer, contextBridge } = require('electron');

// Expose a limited API to the guest page if needed,
// but for now, we mostly care about the webview tag's own events
// handled by the host renderer.

// Example: if guest pages need to send messages to the host renderer
contextBridge.exposeInMainWorld('electronWebviewHost', {
  sendToHost: (channel: any, ...args: any) => {
    ipcRenderer.sendToHost(channel, ...args);
  },
  // Potentially receive messages from host, though less common for this direction
  // onMessageFromHost: (channel, listener) => {
  //   ipcRenderer.on(channel, (event, ...args) => listener(...args));
  // }
});

// Intercept console.log from webview and forward to main process for unified logging
const originalConsoleLog = console.log;
console.log = (...args) => {
  ipcRenderer.sendToHost('webview-console-log', ...args.map(arg => String(arg))); // Send to host renderer
  originalConsoleLog(...args);
};
const originalConsoleError = console.error;
console.error = (...args) => {
  ipcRenderer.sendToHost('webview-console-error', ...args.map(arg => String(arg))); // Send to host renderer
  originalConsoleError(...args);
};


// This preload script runs inside the <webview> tag.
// It can be used to interact with the loaded page or expose APIs to it.
// For now, it's minimal as most control comes from the host page (React app).

// Fix for some sites that check for specific Chrome properties
if (typeof (navigator as any).webkitGetUserMedia === 'undefined') {
  (navigator as any).webkitGetUserMedia = (navigator as any).getUserMedia || (navigator as any).mozGetUserMedia || (navigator as any).msGetUserMedia;
}

// Attempt to fix issues with sites detecting Electron
try {
    //@ts-ignore
    delete process.versions.electron; // Might not work in sandboxed webview
    if (window.navigator && window.navigator.userAgent) {
        // @ts-ignore
        Object.defineProperty(window.navigator, 'userAgent', {
            value: window.navigator.userAgent.replace(/Electron\/\S+\s/, ''),
            writable: false,
            configurable: false
        });
    }
} catch (e) {
    console.warn('Could not modify userAgent or process versions in webview preload.');
}

console.log('Webview preload script loaded.');

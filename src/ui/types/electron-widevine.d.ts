declare module "electron" {
    interface App {
      on(event: "widevine-ready", listener: (version: string, lastVersion: string) => void): this
      on(event: "widevine-update-pending", listener: (currentVersion: string, pendingVersion: string) => void): this
      on(event: "widevine-error", listener: (error: Error) => void): this
  
      once(event: "widevine-ready", listener: (version: string, lastVersion: string) => void): this
      once(event: "widevine-update-pending", listener: (currentVersion: string, pendingVersion: string) => void): this
      once(event: "widevine-error", listener: (error: Error) => void): this
    }
  }
  
  
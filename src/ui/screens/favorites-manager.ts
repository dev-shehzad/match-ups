import { ipcMain, app } from "electron"
import fs from "fs"
import path from "path"

// Define the FavoriteItem interface
export interface FavoriteItem {
  id: string
  url: string
  title: string
  favicon: string
  screenId: number
  addedTime?: number
}

export class FavoritesManager {
  private favoritesPath: string
  private favorites: FavoriteItem[] = []
  private isLoaded = false

  constructor() {
    // Store favorites in the app's user data directory
    this.favoritesPath = path.join(app.getPath("userData"), "browser-favorites.json")
    this.loadFavorites()
    this.setupIpcHandlers()
    console.log("Favorites manager initialized, path:", this.favoritesPath)
  }

  private setupIpcHandlers() {
    // Add a URL to favorites
    ipcMain.handle("favorites:add", (_, favoriteItem: Omit<FavoriteItem, "id" | "addedTime">) => {
      return this.addToFavorites({
        ...favoriteItem,
        id: `fav_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        addedTime: Date.now(),
      })
    })

    // Get all favorites
    ipcMain.handle("favorites:getAll", () => {
      return this.getAllFavorites()
    })

    // Delete favorite item
    ipcMain.handle("favorites:delete", (_, id: string) => {
      return this.deleteFavoriteItem(id)
    })

    // Clear all favorites
    ipcMain.handle("favorites:clear", () => {
      return this.clearFavorites()
    })

    // Save favorites (bulk save)
    ipcMain.handle("favorites:save", (_, favorites: FavoriteItem[]) => {
      return this.saveFavoritesList(favorites)
    })

    // Load favorites
    ipcMain.handle("favorites:load", () => {
      return this.loadFavorites()
    })
  }

  private loadFavorites(): FavoriteItem[] {
    try {
      if (fs.existsSync(this.favoritesPath)) {
        const data = fs.readFileSync(this.favoritesPath, "utf8")
        this.favorites = JSON.parse(data)
        console.log(`Loaded ${this.favorites.length} favorites`)
      } else {
        this.favorites = []
        this.saveFavorites()
      }
      this.isLoaded = true
    } catch (error) {
      console.error("Error loading favorites:", error)
      this.favorites = []
      this.isLoaded = true
    }
    return this.favorites
  }

  private saveFavorites(): boolean {
    try {
      // Create directory if it doesn't exist
      const dir = path.dirname(this.favoritesPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      
      fs.writeFileSync(this.favoritesPath, JSON.stringify(this.favorites, null, 2))
      return true
    } catch (error) {
      console.error("Error saving favorites:", error)
      return false
    }
  }

  private saveFavoritesList(favorites: FavoriteItem[]): boolean {
    try {
      this.favorites = favorites || []
      return this.saveFavorites()
    } catch (error) {
      console.error("Error saving favorites list:", error)
      return false
    }
  }

  private addToFavorites(favoriteItem: FavoriteItem): FavoriteItem[] {
    // Ensure favorites are loaded
    if (!this.isLoaded) {
      this.loadFavorites()
    }

    // Don't add about:blank or empty URLs
    if (!favoriteItem.url || favoriteItem.url === "about:blank") {
      return this.favorites
    }

    // Don't add duplicates
    const exists = this.favorites.some((item) => item.url === favoriteItem.url)
    if (exists) {
      return this.favorites
    }

    console.log("Adding to favorites:", favoriteItem.url, favoriteItem.title)
    this.favorites.unshift(favoriteItem)
    this.saveFavorites()
    return this.favorites
  }

  private getAllFavorites(): FavoriteItem[] {
    if (!this.isLoaded) {
      this.loadFavorites()
    }
    return this.favorites
  }

  private deleteFavoriteItem(id: string): boolean {
    if (!this.isLoaded) {
      this.loadFavorites()
    }

    const initialLength = this.favorites.length
    this.favorites = this.favorites.filter((item) => item.id !== id)

    if (this.favorites.length !== initialLength) {
      this.saveFavorites()
      return true
    }

    return false
  }

  private clearFavorites(): boolean {
    this.favorites = []
    this.saveFavorites()
    return true
  }
}

// Create and export a singleton instance
export const favoritesManager = new FavoritesManager()

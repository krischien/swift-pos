import { Capacitor } from "@capacitor/core";
import { getDatabase } from "./mobileDb";

const DB_NAME = "quickpos";

export interface MobileBackup {
  filename: string;
  size: number;
  date: Date;
  path: string;
}

/**
 * Get the database file path on the device
 * The capacitor-community/sqlite plugin stores databases in a specific location
 * We need to access it through the plugin's methods or known file paths
 */
async function getDatabasePath(): Promise<{ path: string; directory: any }> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error("Backup is only available on native platforms");
  }

  const { Directory } = await import("@capacitor/filesystem");
  const platform = Capacitor.getPlatform();
  
  // The capacitor-community/sqlite plugin stores databases in:
  // Android: Internal storage, typically accessible via Directory.Data
  // iOS: Similar location
  // The actual path structure may vary, so we'll try multiple approaches
  
  if (platform === "android") {
    // Try the standard Android database location
    return { path: `databases/${DB_NAME}.db`, directory: Directory.Data };
  } else if (platform === "ios") {
    // iOS database location
    return { path: `Library/LocalDatabase/${DB_NAME}.db`, directory: Directory.Data };
  }
  
  throw new Error(`Unsupported platform: ${platform}`);
}

/**
 * Create a backup of the mobile database
 * Returns the backup file path
 */
export async function createMobileBackup(): Promise<string> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error("Backup is only available on native platforms");
  }

  try {
    let CapacitorSQLite: any;
    let SQLiteConnection: any;
    
    try {
      // Use a more robust import that handles module resolution issues
      const sqliteModule = await import("@capacitor-community/sqlite");
      CapacitorSQLite = sqliteModule.CapacitorSQLite;
      SQLiteConnection = sqliteModule.SQLiteConnection;
      
      // Verify the classes are available
      if (!CapacitorSQLite || !SQLiteConnection) {
        throw new Error("SQLite plugin classes not found in module");
      }
    } catch (error: any) {
      console.error("Failed to import @capacitor-community/sqlite:", error);
      throw new Error(
        `SQLite plugin is not available: ${error?.message || "Unknown error"}. ` +
        "Make sure you're running on a native platform and the plugin is properly installed."
      );
    }
    const sqlite = new SQLiteConnection(CapacitorSQLite);
    
    // Check if the database exists
    const isDb = await sqlite.isDatabase(DB_NAME);
    if (!isDb.result) {
      throw new Error("Database not found");
    }
    
    // Create backup filename with timestamp
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-");
    const backupFilename = `backup-${dateStr}_${timeStr}.db`;
    
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    
    // Get the database path
    const dbPathInfo = await getDatabasePath();
    let dbData: string;
    
    try {
      // Try to read the database file
      const readResult = await Filesystem.readFile({
        path: dbPathInfo.path,
        directory: dbPathInfo.directory,
      });
      dbData = readResult.data as string;
    } catch (error: any) {
      // If direct file access fails, try alternative paths
      console.warn("Could not read database from primary path, trying alternatives...");
      
      // Try alternative path structures
      const alternatives = [
        { path: `${DB_NAME}.db`, directory: Directory.Data },
        { path: `databases/${DB_NAME}`, directory: Directory.Data },
        { path: `SQLite/${DB_NAME}.db`, directory: Directory.Data },
      ];
      
      let found = false;
      for (const alt of alternatives) {
        try {
          const readResult = await Filesystem.readFile({
            path: alt.path,
            directory: alt.directory,
          });
          dbData = readResult.data as string;
          found = true;
          break;
        } catch {
          // Continue to next alternative
        }
      }
      
      if (!found) {
        throw new Error(
          "Could not access database file. The database may be stored in a location that requires special permissions. " +
          "Error: " + (error?.message || "Unknown error")
        );
      }
    }
    
    // Save backup to Documents directory (user-accessible)
    const backupPath = `backups/${backupFilename}`;
    await Filesystem.writeFile({
      path: backupPath,
      data: dbData,
      directory: Directory.Documents,
      recursive: true,
    });
    
    console.log(`[MOBILE BACKUP] Created backup: ${backupFilename}`);
    return backupPath;
  } catch (error: any) {
    console.error("[MOBILE BACKUP] Error creating backup:", error);
    throw new Error(`Failed to create backup: ${error.message}`);
  }
}

/**
 * Export backup file using Share API (allows user to save/share the file)
 */
export async function exportMobileBackup(): Promise<void> {
  try {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    
    const backupPath = await createMobileBackup();
    
    // Read the backup file
    const readResult = await Filesystem.readFile({
      path: backupPath,
      directory: Directory.Documents,
    });
    
    // Get the filename from the path
    const filename = backupPath.split("/").pop() || "backup.db";
    
    // For sharing, we need to write to a temporary location that Share can access
    // On Android, we can use the Cache directory
    const tempPath = `temp/${filename}`;
    await Filesystem.writeFile({
      path: tempPath,
      data: readResult.data,
      directory: Directory.Cache,
      recursive: true,
    });
    
    // Get the full file URI
    const fileUri = await Filesystem.getUri({
      path: tempPath,
      directory: Directory.Cache,
    });
    
    // Share the file
    await Share.share({
      title: "Database Backup",
      text: "Quick Brew Database Backup",
      url: fileUri.uri,
      dialogTitle: "Share Database Backup",
    });
    
    console.log(`[MOBILE BACKUP] Exported backup: ${filename}`);
  } catch (error: any) {
    console.error("[MOBILE BACKUP] Error exporting backup:", error);
    throw new Error(`Failed to export backup: ${error.message}`);
  }
}

/**
 * List all available backups
 */
export async function listMobileBackups(): Promise<MobileBackup[]> {
  if (!Capacitor.isNativePlatform()) {
    return [];
  }

  try {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const backups: MobileBackup[] = [];
    
    // Read backups directory
    try {
      const result = await Filesystem.readdir({
        path: "backups",
        directory: Directory.Documents,
      });
      
      for (const file of result.files) {
        if (file.name.startsWith("backup-") && file.name.endsWith(".db")) {
          const filePath = `backups/${file.name}`;
          const stat = await Filesystem.stat({
            path: filePath,
            directory: Directory.Documents,
          });
          
          backups.push({
            filename: file.name,
            size: stat.size || 0,
            date: new Date(stat.mtime || Date.now()),
            path: filePath,
          });
        }
      }
    } catch (error) {
      // Directory doesn't exist yet, return empty array
      console.log("[MOBILE BACKUP] No backups directory found");
    }
    
    // Sort by date (newest first)
    backups.sort((a, b) => b.date.getTime() - a.date.getTime());
    
    return backups;
  } catch (error: any) {
    console.error("[MOBILE BACKUP] Error listing backups:", error);
    return [];
  }
}

/**
 * Restore database from a backup file
 */
export async function restoreMobileBackup(backupFilename: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error("Restore is only available on native platforms");
  }

  try {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const backupPath = `backups/${backupFilename}`;
    
    // Read the backup file
    const readResult = await Filesystem.readFile({
      path: backupPath,
      directory: Directory.Documents,
    });
    
    let CapacitorSQLite: any;
    let SQLiteConnection: any;
    
    try {
      // Use a more robust import that handles module resolution issues
      const sqliteModule = await import("@capacitor-community/sqlite");
      CapacitorSQLite = sqliteModule.CapacitorSQLite;
      SQLiteConnection = sqliteModule.SQLiteConnection;
      
      // Verify the classes are available
      if (!CapacitorSQLite || !SQLiteConnection) {
        throw new Error("SQLite plugin classes not found in module");
      }
    } catch (error: any) {
      console.error("Failed to import @capacitor-community/sqlite:", error);
      throw new Error(
        `SQLite plugin is not available: ${error?.message || "Unknown error"}. ` +
        "Make sure you're running on a native platform and the plugin is properly installed."
      );
    }
    const sqlite = new SQLiteConnection(CapacitorSQLite);
    
    // Close the current database connection if it exists
    try {
      const isConn = (await sqlite.checkConnectionsConsistency()).result;
      if (isConn) {
        await sqlite.closeConnection(DB_NAME, false);
      }
    } catch (error) {
      console.warn("Could not close existing connection:", error);
    }
    
    // Create a backup of current database before restore
    try {
      const preRestoreBackup = `backup-pre-restore-${Date.now()}.db`;
      const dbPathInfo = await getDatabasePath();
      
      try {
        const currentDbData = await Filesystem.readFile({
          path: dbPathInfo.path,
          directory: dbPathInfo.directory,
        });
        await Filesystem.writeFile({
          path: `backups/${preRestoreBackup}`,
          data: currentDbData.data,
          directory: Directory.Documents,
          recursive: true,
        });
        console.log(`[MOBILE RESTORE] Created pre-restore backup: ${preRestoreBackup}`);
      } catch (error) {
        console.warn("[MOBILE RESTORE] Could not create pre-restore backup (database may not exist yet):", error);
      }
    } catch (error) {
      console.warn("[MOBILE RESTORE] Could not create pre-restore backup:", error);
    }
    
    // Delete the existing database if it exists
    try {
      const isDb = await sqlite.isDatabase(DB_NAME);
      if (isDb.result) {
        await sqlite.deleteDatabase(DB_NAME);
      }
    } catch (error) {
      console.warn("Could not delete existing database:", error);
    }
    
    // Get the database path and copy the backup file to the database location
    const dbPathInfo = await getDatabasePath();
    
    await Filesystem.writeFile({
      path: dbPathInfo.path,
      data: readResult.data,
      directory: dbPathInfo.directory,
      recursive: true,
    });
    
    // Reinitialize the database connection
    // Clear the cached database instance
    const mobileDbModule = await import("./mobileDb");
    (mobileDbModule as any).db = null;
    
    // Reopen the database
    await getDatabase();
    
    console.log(`[MOBILE RESTORE] Successfully restored from: ${backupFilename}`);
  } catch (error: any) {
    console.error("[MOBILE RESTORE] Error restoring backup:", error);
    throw new Error(`Failed to restore backup: ${error.message}`);
  }
}

/**
 * Import a backup file from user's file system
 * This will prompt the user to select a file
 */
export async function importMobileBackup(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    throw new Error("Import is only available on native platforms");
  }

  // For file picking, we'll need to use a file picker plugin
  // For now, we'll use a workaround: the user can share the file to the app
  // or we can use the Filesystem API to read from a known location
  
  // This is a placeholder - in a real implementation, you'd use a file picker plugin
  // like @capacitor-community/file-picker or similar
  throw new Error("File import not yet implemented. Please use the restore function with an existing backup.");
}


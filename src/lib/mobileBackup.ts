import { Capacitor } from "@capacitor/core";
import { getDatabase, resetDatabaseConnection } from "./mobileDb";
import { APP_NAME } from "@/config/brand";

const DB_NAME = "quickpos";

export interface MobileBackup {
  filename: string;
  size: number;
  date: Date;
  path: string;
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
    // Ensure db is initialized/open then export using plugin APIs.
    const db = await getDatabase();

    // Create backup filename with timestamp
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-");
    const backupFilename = `backup-${dateStr}_${timeStr}.json`;
    
    const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");

    // Export entire database to JSON (portable, no filesystem DB path guessing).
    // "full" includes schema + data.
    // NOTE: The native import/validation expects the JsonSQLite object, not the { export: ... } wrapper.
    const exportJson = await db.exportToJson("full");
    const jsonString = JSON.stringify((exportJson && exportJson.export) ? exportJson.export : exportJson);

    // Save backup to Documents directory (user-accessible)
    const backupPath = `backups/${backupFilename}`;
    await Filesystem.writeFile({
      path: backupPath,
      data: jsonString,
      directory: Directory.Documents,
      recursive: true,
      encoding: Encoding.UTF8,
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
    const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    
    const backupPath = await createMobileBackup();
    
    // Read the backup file
    const readResult = await Filesystem.readFile({
      path: backupPath,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
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
      encoding: Encoding.UTF8,
    });
    
    // Get the full file URI
    const fileUri = await Filesystem.getUri({
      path: tempPath,
      directory: Directory.Cache,
    });
    
    // Share the file
    await Share.share({
      title: "Database Backup",
      text: `${APP_NAME} Database Backup`,
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
        if (file.name.startsWith("backup-") && file.name.endsWith(".json")) {
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
    if (!backupFilename.toLowerCase().endsWith(".json")) {
      throw new Error(
        "Unsupported backup format. Please create a new mobile backup (JSON) using the updated app before restoring.",
      );
    }

    const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
    const backupPath = `backups/${backupFilename}`;
    
    // Read the backup file
    const readResult = await Filesystem.readFile({
      path: backupPath,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });
    
    const { CapacitorSQLite, SQLiteConnection } = await import("@capacitor-community/sqlite");
    const sqlite = new SQLiteConnection(CapacitorSQLite);
    let jsonstring = typeof readResult.data === "string" ? readResult.data : String(readResult.data);

    // Backward compatibility: older backups might have been written without Encoding.UTF8,
    // causing the file content to be base64. Try to detect/decode.
    const looksLikeJson = (value: string) => value.trim().startsWith("{") && value.trim().endsWith("}");
    const looksLikeBase64 = (value: string) =>
      /^[A-Za-z0-9+/=\r\n]+$/.test(value) && value.length % 4 === 0 && value.length > 32;

    if (!looksLikeJson(jsonstring) && looksLikeBase64(jsonstring)) {
      try {
        const decoded = atob(jsonstring.replace(/\s+/g, ""));
        if (looksLikeJson(decoded)) {
          jsonstring = decoded;
        }
      } catch {
        // ignore
      }
    }

    // Normalize payload shape:
    // - backups should be the JsonSQLite shape
    // - but older files might have been saved as { export: JsonSQLite }
    try {
      const parsed = JSON.parse(jsonstring);
      if (parsed && typeof parsed === "object" && "export" in parsed && parsed.export) {
        jsonstring = JSON.stringify(parsed.export);
      }
    } catch {
      // keep as-is; plugin will reject if malformed
    }

    // Validate JSON before applying
    const valid = await CapacitorSQLite.isJsonValid({ jsonstring });
    if (!valid.result) {
      throw new Error("Invalid backup file (JSON validation failed)");
    }
    
    // Close the current database connection if it exists
    try {
      const isConn = (await sqlite.checkConnectionsConsistency()).result;
      if (isConn) {
        await sqlite.closeConnection(DB_NAME, false);
      }
    } catch (error) {
      console.warn("Could not close existing connection:", error);
    }
    
    // Create a backup of current database before restore (best-effort)
    try {
      await createMobileBackup();
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

    // Import the backup JSON to recreate the database
    await CapacitorSQLite.importFromJson({ jsonstring });

    // Force app code to reopen a fresh connection
    resetDatabaseConnection();
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


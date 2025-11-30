import * as fs from "fs";
import * as path from "path";

// Get paths relative to project root
const PROJECT_ROOT = process.cwd();
const DB_PATH = path.join(PROJECT_ROOT, "prisma", "dev.db");
const BACKUPS_DIR = path.join(PROJECT_ROOT, "backups");

/**
 * Ensure the backups directory exists
 */
function ensureBackupsDirectory(): void {
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    console.log(`Created backups directory: ${BACKUPS_DIR}`);
  }
}

/**
 * Generate a backup filename with timestamp
 */
function getBackupFilename(): string {
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
  const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-"); // HH-MM-SS
  return `backup-${dateStr}_${timeStr}.db`;
}

/**
 * Perform a database backup
 */
export async function performBackup(): Promise<string> {
  try {
    ensureBackupsDirectory();

    // Check if database file exists
    if (!fs.existsSync(DB_PATH)) {
      throw new Error(`Database file not found at: ${DB_PATH}`);
    }

    const backupFilename = getBackupFilename();
    const backupPath = path.join(BACKUPS_DIR, backupFilename);

    // Copy the database file
    fs.copyFileSync(DB_PATH, backupPath);

    const stats = fs.statSync(backupPath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    console.log(`[BACKUP] Successfully created backup: ${backupFilename} (${fileSizeMB} MB)`);
    return backupPath;
  } catch (error: any) {
    console.error("[BACKUP] Error creating backup:", error.message);
    throw error;
  }
}

/**
 * Clean up old backups, keeping only the last N days
 * @param daysToKeep Number of days of backups to keep (default: 30)
 */
export function cleanupOldBackups(daysToKeep: number = 30): void {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      return;
    }

    const files = fs.readdirSync(BACKUPS_DIR);
    const now = Date.now();
    const daysInMs = daysToKeep * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    files.forEach((file) => {
      if (!file.startsWith("backup-") || !file.endsWith(".db")) {
        return;
      }

      const filePath = path.join(BACKUPS_DIR, file);
      const stats = fs.statSync(filePath);
      const fileAge = now - stats.mtimeMs;

      if (fileAge > daysInMs) {
        fs.unlinkSync(filePath);
        deletedCount++;
        console.log(`[BACKUP] Deleted old backup: ${file}`);
      }
    });

    if (deletedCount > 0) {
      console.log(`[BACKUP] Cleaned up ${deletedCount} old backup(s)`);
    }
  } catch (error: any) {
    console.error("[BACKUP] Error cleaning up old backups:", error.message);
  }
}

/**
 * Get list of all backups
 */
export function listBackups(): Array<{ filename: string; path: string; size: number; date: Date }> {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      return [];
    }

    const files = fs.readdirSync(BACKUPS_DIR);
    const backups: Array<{ filename: string; path: string; size: number; date: Date }> = [];

    files.forEach((file) => {
      if (!file.startsWith("backup-") || !file.endsWith(".db")) {
        return;
      }

      const filePath = path.join(BACKUPS_DIR, file);
      const stats = fs.statSync(filePath);
      backups.push({
        filename: file,
        path: filePath,
        size: stats.size,
        date: stats.mtime,
      });
    });

    // Sort by date, newest first
    backups.sort((a, b) => b.date.getTime() - a.date.getTime());

    return backups;
  } catch (error: any) {
    console.error("[BACKUP] Error listing backups:", error.message);
    return [];
  }
}

/**
 * Get the latest backup filename
 */
export function getLatestBackup(): string | null {
  const backups = listBackups();
  return backups.length > 0 ? backups[0].filename : null;
}

/**
 * Restore database from a backup file
 * @param backupFilename The filename of the backup to restore from
 * @param createBackupBeforeRestore Whether to create a backup of current DB before restoring (default: true)
 */
export async function restoreFromBackup(
  backupFilename: string,
  createBackupBeforeRestore: boolean = true
): Promise<string> {
  try {
    const backupPath = path.join(BACKUPS_DIR, backupFilename);

    // Validate backup file exists
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupFilename}`);
    }

    // Validate it's a backup file
    if (!backupFilename.startsWith("backup-") || !backupFilename.endsWith(".db")) {
      throw new Error(`Invalid backup filename: ${backupFilename}`);
    }

    // Create a backup of current database before restoring (safety measure)
    if (createBackupBeforeRestore && fs.existsSync(DB_PATH)) {
      const preRestoreBackup = `pre-restore-${Date.now()}.db`;
      const preRestorePath = path.join(BACKUPS_DIR, preRestoreBackup);
      fs.copyFileSync(DB_PATH, preRestorePath);
      console.log(`[RESTORE] Created pre-restore backup: ${preRestoreBackup}`);
    }

    // Copy backup file to database location
    fs.copyFileSync(backupPath, DB_PATH);

    const stats = fs.statSync(DB_PATH);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    console.log(`[RESTORE] Successfully restored database from: ${backupFilename} (${fileSizeMB} MB)`);
    return DB_PATH;
  } catch (error: any) {
    console.error("[RESTORE] Error restoring from backup:", error.message);
    throw error;
  }
}


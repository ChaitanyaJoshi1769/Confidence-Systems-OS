import * as SQLite from 'expo-sqlite';

export interface Evidence {
  id: string;
  evidenceType: string;
  fileUrl?: string;
  fileKey?: string;
  fileSize?: number;
  mimeType?: string;
  latitude?: number;
  longitude?: number;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
  isSynced: boolean;
}

export interface TaskInstance {
  id: string;
  workflowRunId: string;
  taskId: string;
  status: string;
  assignedTo?: string;
  evidenceIds: string[];
  createdAt: string;
  updatedAt: string;
  syncedAt?: string;
  isSynced: boolean;
}

export class DatabaseService {
  private static db: SQLite.Database;

  static async initialize(): Promise<void> {
    this.db = await SQLite.openDatabaseAsync('confidence-systems.db');

    await this.createTables();
  }

  private static async createTables(): Promise<void> {
    await this.db.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS evidence (
        id TEXT PRIMARY KEY,
        evidence_type TEXT NOT NULL,
        file_url TEXT,
        file_key TEXT,
        file_size INTEGER,
        mime_type TEXT,
        latitude REAL,
        longitude REAL,
        metadata TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        synced_at TEXT,
        is_synced BOOLEAN DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS task_instances (
        id TEXT PRIMARY KEY,
        workflow_run_id TEXT NOT NULL,
        task_id TEXT NOT NULL,
        status TEXT NOT NULL,
        assigned_to TEXT,
        evidence_ids TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        synced_at TEXT,
        is_synced BOOLEAN DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        action TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        attempt_count INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_evidence_is_synced ON evidence(is_synced);
      CREATE INDEX IF NOT EXISTS idx_task_instances_is_synced ON task_instances(is_synced);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_created_at ON sync_queue(created_at);
    `);
  }

  // Evidence operations
  static async saveEvidence(evidence: Evidence): Promise<void> {
    await this.db.runAsync(
      `INSERT OR REPLACE INTO evidence (
        id, evidence_type, file_url, file_key, file_size, mime_type,
        latitude, longitude, metadata, created_at, updated_at, is_synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        evidence.id,
        evidence.evidenceType,
        evidence.fileUrl || null,
        evidence.fileKey || null,
        evidence.fileSize || null,
        evidence.mimeType || null,
        evidence.latitude || null,
        evidence.longitude || null,
        JSON.stringify(evidence.metadata || {}),
        evidence.createdAt,
        evidence.updatedAt,
        evidence.isSynced ? 1 : 0,
      ],
    );

    // Add to sync queue if not synced
    if (!evidence.isSynced) {
      await this.addToSyncQueue('evidence', evidence.id, 'create', evidence);
    }
  }

  static async getEvidence(id: string): Promise<Evidence | null> {
    const result = await this.db.getFirstAsync<any>(
      'SELECT * FROM evidence WHERE id = ?',
      [id],
    );

    return result ? this.mapEvidenceRow(result) : null;
  }

  static async getAllEvidence(): Promise<Evidence[]> {
    const results = await this.db.getAllAsync<any>(
      'SELECT * FROM evidence ORDER BY created_at DESC',
    );

    return results.map((row) => this.mapEvidenceRow(row));
  }

  static async getUnsyncedEvidence(): Promise<Evidence[]> {
    const results = await this.db.getAllAsync<any>(
      'SELECT * FROM evidence WHERE is_synced = 0 ORDER BY created_at ASC',
    );

    return results.map((row) => this.mapEvidenceRow(row));
  }

  static async markEvidenceSynced(id: string): Promise<void> {
    await this.db.runAsync(
      'UPDATE evidence SET is_synced = 1, synced_at = ? WHERE id = ?',
      [new Date().toISOString(), id],
    );
  }

  // Sync queue operations
  static async addToSyncQueue(
    entityType: string,
    entityId: string,
    action: string,
    payload: any,
  ): Promise<void> {
    const id = `${entityType}-${entityId}-${Date.now()}`;
    await this.db.runAsync(
      `INSERT INTO sync_queue (id, entity_type, entity_id, action, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, entityType, entityId, action, JSON.stringify(payload), new Date().toISOString()],
    );
  }

  static async getSyncQueue(): Promise<any[]> {
    return this.db.getAllAsync(
      `SELECT * FROM sync_queue ORDER BY created_at ASC LIMIT 100`,
    );
  }

  static async removeSyncQueueItem(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM sync_queue WHERE id = ?', [id]);
  }

  static async incrementSyncAttempt(id: string): Promise<void> {
    await this.db.runAsync(
      'UPDATE sync_queue SET attempt_count = attempt_count + 1 WHERE id = ?',
      [id],
    );
  }

  // Task instance operations
  static async saveTaskInstance(task: TaskInstance): Promise<void> {
    await this.db.runAsync(
      `INSERT OR REPLACE INTO task_instances (
        id, workflow_run_id, task_id, status, assigned_to,
        evidence_ids, created_at, updated_at, is_synced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id,
        task.workflowRunId,
        task.taskId,
        task.status,
        task.assignedTo || null,
        JSON.stringify(task.evidenceIds || []),
        task.createdAt,
        task.updatedAt,
        task.isSynced ? 1 : 0,
      ],
    );

    if (!task.isSynced) {
      await this.addToSyncQueue('task_instance', task.id, 'create', task);
    }
  }

  static async getTaskInstance(id: string): Promise<TaskInstance | null> {
    const result = await this.db.getFirstAsync<any>(
      'SELECT * FROM task_instances WHERE id = ?',
      [id],
    );

    return result ? this.mapTaskInstanceRow(result) : null;
  }

  static async getAllTaskInstances(): Promise<TaskInstance[]> {
    const results = await this.db.getAllAsync<any>(
      'SELECT * FROM task_instances ORDER BY created_at DESC',
    );

    return results.map((row) => this.mapTaskInstanceRow(row));
  }

  // Helper methods
  private static mapEvidenceRow(row: any): Evidence {
    return {
      id: row.id,
      evidenceType: row.evidence_type,
      fileUrl: row.file_url,
      fileKey: row.file_key,
      fileSize: row.file_size,
      mimeType: row.mime_type,
      latitude: row.latitude,
      longitude: row.longitude,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      syncedAt: row.synced_at,
      isSynced: !!row.is_synced,
    };
  }

  private static mapTaskInstanceRow(row: any): TaskInstance {
    return {
      id: row.id,
      workflowRunId: row.workflow_run_id,
      taskId: row.task_id,
      status: row.status,
      assignedTo: row.assigned_to,
      evidenceIds: row.evidence_ids ? JSON.parse(row.evidence_ids) : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      syncedAt: row.synced_at,
      isSynced: !!row.is_synced,
    };
  }
}

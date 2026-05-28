import NetInfo from 'react-native-netinfo';
import { DatabaseService } from '../database/database.service';
import { APIService } from './api.service';

export interface SyncState {
  isSyncing: boolean;
  lastSyncTime?: Date;
  syncErrors: string[];
  syncedCount: number;
  totalPendingCount: number;
}

class SyncServiceClass {
  private syncState: SyncState = {
    isSyncing: false,
    syncErrors: [],
    syncedCount: 0,
    totalPendingCount: 0,
  };

  private syncInterval: NodeJS.Timer | null = null;
  private subscribers: ((state: SyncState) => void)[] = [];

  initialize() {
    // Check network status and sync when online
    NetInfo.fetch().then((state) => {
      if (state.isConnected) {
        this.performSync();
      }
    });

    // Listen for network changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && !this.syncState.isSyncing) {
        this.performSync();
      }
    });

    // Periodic sync check (every 5 minutes)
    this.syncInterval = setInterval(() => {
      NetInfo.fetch().then((state) => {
        if (state.isConnected && !this.syncState.isSyncing) {
          this.performSync();
        }
      });
    }, 5 * 60 * 1000);

    return unsubscribe;
  }

  async performSync() {
    if (this.syncState.isSyncing) {
      return;
    }

    this.syncState.isSyncing = true;
    this.notifySubscribers();

    try {
      const syncQueue = await DatabaseService.getSyncQueue();
      this.syncState.totalPendingCount = syncQueue.length;

      if (syncQueue.length === 0) {
        this.syncState.isSyncing = false;
        this.syncState.lastSyncTime = new Date();
        this.notifySubscribers();
        return;
      }

      let successCount = 0;

      for (const item of syncQueue) {
        try {
          await this.processSyncItem(item);
          successCount++;
          await DatabaseService.removeSyncQueueItem(item.id);
        } catch (error) {
          console.error(`Sync item failed: ${item.id}`, error);
          await DatabaseService.incrementSyncAttempt(item.id);

          // Don't retry if too many attempts
          if ((item.attempt_count || 0) >= 3) {
            await DatabaseService.removeSyncQueueItem(item.id);
            this.syncState.syncErrors.push(
              `Failed to sync ${item.entity_type} after 3 attempts`,
            );
          }
        }
      }

      this.syncState.syncedCount = successCount;
      this.syncState.lastSyncTime = new Date();
    } catch (error) {
      console.error('Sync error:', error);
      this.syncState.syncErrors.push(String(error));
    } finally {
      this.syncState.isSyncing = false;
      this.notifySubscribers();
    }
  }

  private async processSyncItem(item: any) {
    const payload = JSON.parse(item.payload);

    switch (item.entity_type) {
      case 'evidence':
        await this.syncEvidence(payload, item.action);
        break;
      case 'task_instance':
        await this.syncTaskInstance(payload, item.action);
        break;
      default:
        throw new Error(`Unknown entity type: ${item.entity_type}`);
    }
  }

  private async syncEvidence(evidence: any, action: string) {
    if (action === 'create') {
      if (evidence.fileUrl && evidence.fileUrl.startsWith('file://')) {
        // Upload file if it's a local file
        await APIService.uploadFile('/evidence', {
          uri: evidence.fileUrl,
          name: `evidence-${evidence.id}`,
          type: evidence.mimeType || 'image/jpeg',
        });
      } else {
        // Create evidence record
        await APIService.post('/evidence', evidence);
      }

      // Mark as synced
      await DatabaseService.markEvidenceSynced(evidence.id);
    }
  }

  private async syncTaskInstance(task: any, action: string) {
    if (action === 'create') {
      await APIService.post('/tasks', task);
    } else if (action === 'update') {
      await APIService.put(`/tasks/${task.id}`, task);
    }
  }

  subscribe(callback: (state: SyncState) => void): () => void {
    this.subscribers.push(callback);

    // Immediately call with current state
    callback(this.syncState);

    // Return unsubscribe function
    return () => {
      this.subscribers = this.subscribers.filter((sub) => sub !== callback);
    };
  }

  private notifySubscribers() {
    this.subscribers.forEach((callback) => callback(this.syncState));
  }

  getSyncState(): SyncState {
    return { ...this.syncState };
  }

  destroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.subscribers = [];
  }
}

export const SyncService = new SyncServiceClass();

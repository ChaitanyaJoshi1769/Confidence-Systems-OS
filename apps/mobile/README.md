# Confidence Systems OS - Mobile Application

React Native mobile app for iOS and Android supporting offline-first evidence capture, task management, and real-time synchronization with the Confidence Systems platform.

## Features

- **Offline-First Architecture**: Full functionality without network connectivity
- **Evidence Capture**: Photo, video, document, GPS, and sensor data capture
- **Task Management**: Real-time task assignment and completion tracking
- **Auto-Sync**: Intelligent synchronization of captured data when online
- **Local Storage**: SQLite-based offline database with sync queue
- **Authentication**: JWT-based secure authentication with refresh tokens
- **Real-time Updates**: Push notifications for task updates and alerts

## Tech Stack

- **Framework**: React Native with Expo
- **Language**: TypeScript
- **State Management**: Zustand
- **Data Fetching**: TanStack React Query
- **Local Database**: SQLite (expo-sqlite)
- **Offline Storage**: File system with sync queue
- **Navigation**: React Navigation

## Development Setup

### Prerequisites

- Node.js 18+ or later
- Expo CLI: `npm install -g expo-cli`
- iOS: Xcode 14+
- Android: Android Studio with SDK 31+

### Installation

```bash
cd apps/mobile
npm install
```

### Environment Variables

Create `.env` file:

```
EXPO_PUBLIC_API_URL=http://localhost:3000/api
EXPO_PUBLIC_API_TIMEOUT=10000
```

### Running the App

**Web (for development preview):**

```bash
npm run web
```

**iOS:**

```bash
npm run ios
```

**Android:**

```bash
npm run android
```

**With live reload:**

```bash
npm start
```

Then scan the QR code with Expo Go app (iOS) or use Android emulator.

## Architecture

### Offline-First Design

1. **Local Database**: SQLite stores evidence, tasks, and sync queue
2. **Sync Queue**: Tracks unsynchronized changes
3. **Auto-Sync**: Automatically syncs when network becomes available
4. **Conflict Resolution**: Server data takes precedence on sync conflicts

### Authentication Flow

1. User logs in with email/password
2. Access token stored securely in Secure Store
3. Refresh token used for token renewal
4. JWT automatically injected in API requests
5. 401 responses trigger token refresh

### Evidence Capture

Supported evidence types:
- **Photo**: Camera capture with metadata (GPS, device info, timestamp)
- **Video**: Recording with optional compression
- **Document**: Photo of documents for OCR
- **Signature**: Digital signature capture
- **Sensor**: Accelerometer, gyroscope, ambient light data
- **Audio**: Voice recording for verification

### Synchronization

```
Offline Flow:
1. User captures evidence/completes task
2. Data saved to local SQLite database
3. Item added to sync queue
4. On app background/idle, marked for sync

Online Flow:
1. Network connectivity detected
2. Pull sync queue items
3. Upload files (if any) to S3
4. Send data to API
5. Mark items as synced in local DB
6. Clear sync queue
7. Notify user of sync completion
```

## Project Structure

```
apps/mobile/
├── src/
│   ├── App.tsx                 # Main navigation setup
│   ├── screens/                # UI screens
│   │   ├── auth/              # Login, onboarding
│   │   ├── dashboard/         # Main dashboard
│   │   ├── tasks/             # Task detail views
│   │   ├── evidence/          # Evidence capture & list
│   │   ├── profile/           # User profile
│   │   └── sync/              # Sync status
│   ├── store/                 # Zustand state stores
│   │   └── auth.ts            # Authentication state
│   ├── services/              # Business logic
│   │   ├── api.service.ts     # HTTP client
│   │   ├── sync.service.ts    # Offline sync engine
│   │   └── query-client.ts    # React Query config
│   ├── database/              # Local data layer
│   │   └── database.service.ts # SQLite operations
│   ├── hooks/                 # Custom React hooks
│   ├── components/            # Reusable UI components
│   ├── types/                 # TypeScript types
│   └── utils/                 # Utility functions
├── app.json                    # Expo configuration
├── tsconfig.json              # TypeScript config
└── package.json               # Dependencies
```

## Key Services

### APIService

HTTP client with automatic JWT injection and refresh token handling:

```typescript
// GET request
const data = await APIService.get('/evidence');

// POST with data
await APIService.post('/evidence', evidenceData);

// File upload
await APIService.uploadFile('/evidence/upload', {
  uri: 'file://...',
  name: 'photo.jpg',
  type: 'image/jpeg',
});
```

### DatabaseService

Offline SQLite database for caching and queueing:

```typescript
// Save evidence locally
await DatabaseService.saveEvidence(evidence);

// Get all evidence
const evidence = await DatabaseService.getAllEvidence();

// Sync queue operations
const queue = await DatabaseService.getSyncQueue();
```

### SyncService

Intelligent background synchronization:

```typescript
// Initialize with network monitoring
SyncService.initialize();

// Subscribe to sync state changes
const unsubscribe = SyncService.subscribe((state) => {
  console.log(`Syncing: ${state.syncedCount}/${state.totalPendingCount}`);
});

// Manual sync
await SyncService.performSync();
```

## Security Considerations

- **Token Storage**: Access tokens in memory, refresh tokens in Secure Store
- **HTTPS Only**: All API calls over HTTPS in production
- **Token Rotation**: Automatic refresh token rotation on each request
- **Device Binding**: Device ID validation on server side
- **Data Encryption**: SQLite database encrypted using device keychain

## Performance Optimization

- **Query Caching**: React Query caches API responses
- **Image Compression**: Auto-compression of captured images
- **Batch Sync**: Groups multiple items into single API calls
- **Progressive Loading**: Pagination for large lists
- **Code Splitting**: Lazy loading of screens

## Testing

```bash
# Run tests
npm run test

# Watch mode
npm run test -- --watch

# Coverage
npm run test -- --coverage
```

## Building for Production

### iOS

```bash
npm run build:ios
npm run submit:ios
```

### Android

```bash
npm run build:android
npm run submit:android
```

## Troubleshooting

**White screen on startup?**
- Clear Metro cache: `npm start -- -c`
- Reset Expo: `npm start -- --reset-cache`

**Database migration issues?**
- Delete app and reinstall
- Clear app cache in device settings

**Sync not working?**
- Check network status: `NetInfo.fetch()`
- Verify API endpoint in `.env`
- Check server logs for 401 errors

**Performance issues?**
- Profile with React DevTools
- Check database size: `adb shell` -> `sqlite3 <db_path>`
- Reduce image quality settings

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

Proprietary - Confidence Systems Inc.

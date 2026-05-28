import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';

import { AuthStore } from './store/auth';
import { SyncService } from './services/sync.service';
import { DatabaseService } from './database/database.service';

// Screens
import { LoginScreen } from './screens/auth/LoginScreen';
import { OnboardingScreen } from './screens/auth/OnboardingScreen';
import { DashboardScreen } from './screens/dashboard/DashboardScreen';
import { TaskDetailScreen } from './screens/tasks/TaskDetailScreen';
import { EvidenceCaptureScreen } from './screens/evidence/EvidenceCaptureScreen';
import { EvidenceListScreen } from './screens/evidence/EvidenceListScreen';
import { ProfileScreen } from './screens/profile/ProfileScreen';
import { SyncStatusScreen } from './screens/sync/SyncStatusScreen';

import { queryClient } from './services/query-client';

SplashScreen.preventAutoHideAsync();

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function DashboardStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '#0F172A' },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: 'Confidence Systems' }}
      />
      <Stack.Screen
        name="TaskDetail"
        component={TaskDetailScreen}
        options={{ title: 'Task Details' }}
      />
    </Stack.Navigator>
  );
}

function EvidenceStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '#0F172A' },
        headerTintColor: '#fff',
      }}
    >
      <Stack.Screen
        name="EvidenceList"
        component={EvidenceListScreen}
        options={{ title: 'Evidence' }}
      />
      <Stack.Screen
        name="EvidenceCapture"
        component={EvidenceCaptureScreen}
        options={{ title: 'Capture Evidence' }}
      />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: '#0F172A' },
        headerTintColor: '#fff',
      }}
    >
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
      <Stack.Screen
        name="SyncStatus"
        component={SyncStatusScreen}
        options={{ title: 'Sync Status' }}
      />
    </Stack.Navigator>
  );
}

function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0F172A',
          borderTopColor: '#1E293B',
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontSize: 12 },
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: '#64748B',
      }}
    >
      <Tab.Screen
        name="DashboardStack"
        component={DashboardStack}
        options={{
          title: 'Dashboard',
          tabBarLabel: 'Dashboard',
        }}
      />
      <Tab.Screen
        name="EvidenceStack"
        component={EvidenceStack}
        options={{
          title: 'Evidence',
          tabBarLabel: 'Evidence',
        }}
      />
      <Tab.Screen
        name="ProfileStack"
        component={ProfileStack}
        options={{
          title: 'Profile',
          tabBarLabel: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  const { isAuthenticated, isLoading, initialize } = AuthStore();

  useEffect(() => {
    const bootstrap = async () => {
      try {
        // Initialize database
        await DatabaseService.initialize();

        // Initialize auth
        await initialize();

        // Initialize sync service
        SyncService.initialize();
      } catch (e) {
        console.error('Initialization error:', e);
      } finally {
        SplashScreen.hideAsync();
      }
    };

    bootstrap();
  }, [initialize]);

  if (isLoading) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer>
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              animationEnabled: true,
            }}
          >
            {!isAuthenticated ? (
              <>
                <Stack.Screen
                  name="Onboarding"
                  component={OnboardingScreen}
                  options={{ animationEnabled: false }}
                />
                <Stack.Screen
                  name="Login"
                  component={LoginScreen}
                  options={{ animationEnabled: true }}
                />
              </>
            ) : (
              <Stack.Screen
                name="AppTabs"
                component={AppTabs}
                options={{ animationEnabled: false }}
              />
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

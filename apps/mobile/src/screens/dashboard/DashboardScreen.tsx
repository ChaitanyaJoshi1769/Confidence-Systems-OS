import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { AuthStore } from '../../store/auth';

export function DashboardScreen() {
  const { user } = AuthStore();

  return (
    <ScrollView style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 20 }}>
        Welcome, {user?.firstName}
      </Text>

      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 14, color: '#666' }}>Active Tasks</Text>
        <Text style={{ fontSize: 24, fontWeight: '600' }}>0</Text>
      </View>

      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 14, color: '#666' }}>Evidence Captured</Text>
        <Text style={{ fontSize: 24, fontWeight: '600' }}>0</Text>
      </View>

      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 14, color: '#666' }}>Pending Sync</Text>
        <Text style={{ fontSize: 24, fontWeight: '600' }}>0</Text>
      </View>
    </ScrollView>
  );
}

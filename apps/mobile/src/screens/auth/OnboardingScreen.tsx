import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';

export function OnboardingScreen() {
  const navigation = useNavigation<any>();

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 20 }}>
      <Text style={{ fontSize: 28, fontWeight: 'bold', marginBottom: 20 }}>
        Welcome to Confidence Systems
      </Text>
      <Text style={{ fontSize: 16, marginBottom: 30, lineHeight: 24 }}>
        Capture, verify, and manage evidence with confidence. Transform institutional knowledge into verifiable, executable workflows.
      </Text>
      <TouchableOpacity
        onPress={() => navigation.navigate('Login')}
        style={{ backgroundColor: '#3B82F6', padding: 15, borderRadius: 5, alignItems: 'center' }}
      >
        <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>Get Started</Text>
      </TouchableOpacity>
    </View>
  );
}

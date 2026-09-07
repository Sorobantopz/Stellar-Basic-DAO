import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, SafeAreaView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { VersionCheckService, VersionCheckResult } from '../services/VersionCheckService';
import { ReleaseNotes } from './ReleaseNotes';

/** Version whose release notes were already shown to this device. */
const RELEASE_NOTES_SEEN_KEY = 'STELLAR_BASIC_DAO.releaseNotes.seenVersion';

interface ForceUpgradeGateProps {
  children: React.ReactNode;
}

export function ForceUpgradeGate({ children }: ForceUpgradeGateProps) {
  const [versionInfo, setVersionInfo] = useState<VersionCheckResult | null>(null);
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function runCheck() {
      const info = await VersionCheckService.checkVersion();
      if (cancelled) return;
      setVersionInfo(info);

      if (info.status === 'optional_upgrade') {
        // Auto-show release notes once per app version: remember which
        // version's notes have been shown so a relaunch (or the version
        // check cache) does not re-prompt the user every time.
        const seen = await AsyncStorage.getItem(RELEASE_NOTES_SEEN_KEY);
        if (!cancelled && seen !== info.latestVersion) {
          setShowReleaseNotes(true);
          await AsyncStorage.setItem(
            RELEASE_NOTES_SEEN_KEY,
            info.latestVersion,
          ).catch(() => {});
        }
      }
    }

    // checkVersion never rejects (it falls back to a safe default), but keep
    // the chain guarded so a storage failure cannot produce an unhandled
    // rejection at app startup.
    runCheck().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  const handleUpdate = () => {
    if (versionInfo?.storeUrl) {
      Linking.openURL(versionInfo.storeUrl);
    }
  };

  if (!versionInfo) {
    return <>{children}</>;
  }

  if (versionInfo.status === 'force_upgrade') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.title}>Update Required</Text>
          <Text style={styles.description}>
            You are using an unsupported version of the app. Please update to the latest version to continue using our services securely.
          </Text>
          <TouchableOpacity style={styles.button} onPress={handleUpdate}>
            <Text style={styles.buttonText}>Update Now</Text>
          </TouchableOpacity>
          {versionInfo.releaseNotes.length > 0 && (
            <View style={styles.notesContainer}>
              <Text style={styles.notesTitle}>What's New in {versionInfo.latestVersion}:</Text>
              {versionInfo.releaseNotes.map((note, index) => (
                <Text key={index} style={styles.noteItem}>• {note}</Text>
              ))}
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      {children}
      <ReleaseNotes 
        visible={showReleaseNotes} 
        notes={versionInfo.releaseNotes} 
        version={versionInfo.latestVersion}
        onClose={() => setShowReleaseNotes(false)}
        onUpdate={handleUpdate}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 24,
    alignItems: 'center',
    maxWidth: 400,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  notesContainer: {
    marginTop: 40,
    width: '100%',
    backgroundColor: '#f5f5f5',
    padding: 16,
    borderRadius: 8,
  },
  notesTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333',
  },
  noteItem: {
    color: '#555',
    marginBottom: 4,
    fontSize: 14,
  }
});

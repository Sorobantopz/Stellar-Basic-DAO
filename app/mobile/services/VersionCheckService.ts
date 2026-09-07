import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type VersionCheckResult = {
  status: 'ok' | 'force_upgrade' | 'optional_upgrade';
  latestVersion: string;
  releaseNotes: string[];
  storeUrl: string;
};

export interface VersionCheckOptions {
  /**
   * Bypass the cached result and re-run the check (used on the settings
   * screen's manual "check for updates"). Defaults to false.
   */
  force?: boolean;
}

interface CachedCheck {
  result: VersionCheckResult;
  checkedAt: number;
}

const VERSION_CHECK_CACHE_KEY = 'STELLAR_BASIC_DAO.versionCheck.v1';
/**
 * How long a version-check result is trusted before re-checking. The whole
 * app mounts VersionCheckService on launch (via ForceUpgradeGate); without a
 * cache, an optional-upgrade prompt reappeared on every single launch even
 * after the user dismissed the release notes.
 */
const VERSION_CHECK_TTL_MS = 24 * 60 * 60 * 1000;

// Mock service for minimal implementation
export class VersionCheckService {
  static async checkVersion(
    options: VersionCheckOptions = {},
  ): Promise<VersionCheckResult> {
    const { force = false } = options;

    if (!force) {
      const cached = await this.readCachedResult();
      if (cached && Date.now() - cached.checkedAt < VERSION_CHECK_TTL_MS) {
        return cached.result;
      }
    }

    try {
      const result = this.evaluate();
      await this.persistResult(result);
      return result;
    } catch (error) {
      // Never throw into the UI: a failed check (storage error, bad config)
      // must not block app startup or produce an unhandled rejection.
      // Fall back to the last known result, or a safe "up to date" default.
      const cached = await this.readCachedResult();
      if (cached) return cached.result;
      return {
        status: 'ok',
        latestVersion: Constants.expoConfig?.version || '1.0.0',
        releaseNotes: [],
        storeUrl: '',
      };
    }
  }

  private static async readCachedResult(): Promise<CachedCheck | null> {
    try {
      const raw = await AsyncStorage.getItem(VERSION_CHECK_CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<CachedCheck>;
      if (
        !parsed.result ||
        typeof parsed.result.status !== 'string' ||
        typeof parsed.checkedAt !== 'number'
      ) {
        return null;
      }
      return parsed as CachedCheck;
    } catch {
      return null;
    }
  }

  private static async persistResult(result: VersionCheckResult): Promise<void> {
    const entry: CachedCheck = { result, checkedAt: Date.now() };
    await AsyncStorage.setItem(VERSION_CHECK_CACHE_KEY, JSON.stringify(entry));
  }

  private static evaluate(): VersionCheckResult {
    const currentVersion = Constants.expoConfig?.version || '1.0.0';

    // In a real app, this would be an API call to your backend
    const mockApiResponse = {
      latestVersion: '1.2.0',
      minRequiredVersion: '1.1.0',
      releaseNotes: [
        'Added new security features',
        'Fixed critical bug causing crashes on startup',
        'Improved performance in transaction history'
      ],
      iosStoreUrl: 'https://apps.apple.com/app/id123456789',
      androidStoreUrl: 'market://details?id=com.pulsefy.soter'
    };

    const isForceUpgrade = this.compareVersions(currentVersion, mockApiResponse.minRequiredVersion) < 0;
    const isOptionalUpgrade = !isForceUpgrade && this.compareVersions(currentVersion, mockApiResponse.latestVersion) < 0;

    return {
      status: isForceUpgrade ? 'force_upgrade' : (isOptionalUpgrade ? 'optional_upgrade' : 'ok'),
      latestVersion: mockApiResponse.latestVersion,
      releaseNotes: mockApiResponse.releaseNotes,
      storeUrl: Platform.OS === 'ios' ? mockApiResponse.iosStoreUrl : mockApiResponse.androidStoreUrl,
    };
  }

  /**
   * Semver-style compare for dotted numeric versions. Public so callers and
   * tests can reason about upgrade decisions without a full evaluation.
   */
  static compareVersions(v1: string, v2: string): number {
    const p1 = v1.split('.').map(Number);
    const p2 = v2.split('.').map(Number);
    const length = Math.max(p1.length, p2.length);
    for (let i = 0; i < length; i++) {
      const a = p1[i] || 0;
      const b = p2[i] || 0;
      if (a > b) return 1;
      if (a < b) return -1;
    }
    return 0;
  }
}
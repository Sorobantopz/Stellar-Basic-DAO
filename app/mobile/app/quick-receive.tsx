import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Alert,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import * as Clipboard from "expo-clipboard";
import { useTheme } from "../src/theme/ThemeContext";
import { getWalletSession } from "../services/wallet-session";

/**
 * Resolve the identity shown on the receive card.
 *
 * The app has no username-claiming flow yet, so we fall back to the
 * connected wallet's public key (a real value from the wallet session)
 * instead of a hardcoded placeholder. Returns null when no wallet is
 * connected so the screen can prompt the user to connect first.
 */
function useReceiveIdentity(): { identity: string | null; loading: boolean } {
  const [identity, setIdentity] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getWalletSession()
      .then((session) => {
        if (cancelled) return;
        setIdentity(session?.publicKey ?? null);
      })
      .catch(() => {
        if (!cancelled) setIdentity(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { identity, loading };
}

export default function QuickReceiveScreen() {
  const { identity, loading } = useReceiveIdentity();
  const { theme } = useTheme();

  const receiveLink = useMemo(() => {
    if (!identity) return null;
    // Without a claimed username we use the wallet address directly; the
    // payment-link parser accepts a public key as the destination.
    return `https://RustAcademy.to/${identity}`;
  }, [identity]);

  const handleCopy = async () => {
    if (!receiveLink) return;
    await Clipboard.setStringAsync(receiveLink);
    Alert.alert("Copied", "Link copied to clipboard");
  };

  const handleShare = async () => {
    if (!receiveLink) return;

    await Share.share({
      message: `Send me payment via RustAcademy:\n${receiveLink}`,
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.textPrimary }]}>
        Quick Receive
      </Text>

      {loading ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.warning, { color: theme.textPrimary }]}>
            Loading…
          </Text>
        </View>
      ) : !identity ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.warning, { color: theme.textPrimary }]}>
            No wallet connected.
          </Text>
          <Text style={[styles.subText, { color: theme.textSecondary }]}>
            Connect a wallet to start receiving payments.
          </Text>
        </View>
      ) : (
        <>
          <Text style={[styles.username, { color: theme.textPrimary }]}>
            {identity}
          </Text>

          {/* QR codes must always be black-on-white for scanner readability */}
          <View
            style={[styles.qrWrapper, { backgroundColor: theme.qrBackground }]}
          >
            <QRCode
              value={receiveLink!}
              size={220}
              backgroundColor={theme.qrBackground}
              color={theme.qrForeground}
            />
          </View>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              { backgroundColor: theme.status.info },
            ]}
            onPress={handleCopy}
          >
            <Text
              style={[styles.buttonText, { color: theme.buttonPrimaryText }]}
            >
              Copy Link
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.secondaryButton,
              { backgroundColor: theme.status.success },
            ]}
            onPress={handleShare}
          >
            <Text
              style={[styles.buttonText, { color: theme.buttonPrimaryText }]}
            >
              Share
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 24,
  },
  username: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 20,
  },
  qrWrapper: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 30,
  },
  primaryButton: {
    width: "100%",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  secondaryButton: {
    width: "100%",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: {
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
  },
  warning: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 6,
  },
  subText: {
    fontSize: 14,
    opacity: 0.7,
  },
});

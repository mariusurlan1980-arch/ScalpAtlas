import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FREE_ANALYSIS_LIMIT } from './commercialAccess';

type Props = {
  remainingFreeAnalyses: number;
  subscriptionActive: boolean;
  busy?: boolean;
  monthlyPrice?: string | null;
  annualPrice?: string | null;
  storeConnected?: boolean;
  verificationReady?: boolean;
  onSubscribeMonthly: () => void;
  onSubscribeAnnual: () => void;
  onRestorePurchases: () => void;
};

export default function SubscriptionPaywall({
  remainingFreeAnalyses,
  subscriptionActive,
  busy = false,
  monthlyPrice,
  annualPrice,
  storeConnected = false,
  verificationReady = false,
  onSubscribeMonthly,
  onSubscribeAnnual,
  onRestorePurchases,
}: Props) {
  if (subscriptionActive) {
    return (
      <View style={styles.card}>
        <Text style={styles.eyebrow}>SCALP ATLAS PREMIUM</Text>
        <Text style={styles.title}>Abonament activ</Text>
        <Text style={styles.body}>Analizele sunt deblocate cât timp abonamentul rămâne activ.</Text>
      </View>
    );
  }

  if (remainingFreeAnalyses > 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.eyebrow}>PERIOADĂ DE TEST</Text>
        <Text style={styles.title}>{remainingFreeAnalyses} din {FREE_ANALYSIS_LIMIT} analize gratuite rămase</Text>
        <Text style={styles.body}>
          Poți testa analiza reală a graficelor. O încercare este consumată numai după o analiză finalizată.
        </Text>
      </View>
    );
  }

  const monthlyLabel = monthlyPrice ? `ABONAMENT LUNAR • ${monthlyPrice}` : 'ABONAMENT LUNAR';
  const annualLabel = annualPrice ? `ABONAMENT ANUAL • ${annualPrice}` : 'ABONAMENT ANUAL';

  return (
    <View style={[styles.card, styles.paywall]}>
      <Text style={styles.eyebrow}>SCALP ATLAS PREMIUM</Text>
      <Text style={styles.title}>Cele {FREE_ANALYSIS_LIMIT} analize gratuite au fost folosite</Text>
      <Text style={styles.body}>
        Pentru a continua analiza graficelor, activează un abonament. Prețul este furnizat direct de magazinul dispozitivului și poate varia în funcție de țară.
      </Text>

      <Pressable disabled={busy} onPress={onSubscribeMonthly} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>{busy ? 'SE PROCESEAZĂ…' : monthlyLabel}</Text>
      </Pressable>

      <Pressable disabled={busy} onPress={onSubscribeAnnual} style={styles.secondaryButton}>
        <Text style={styles.secondaryButtonText}>{annualLabel}</Text>
      </Pressable>

      <Pressable disabled={busy} onPress={onRestorePurchases} style={styles.restoreButton}>
        <Text style={styles.restoreText}>Restabilește achiziția</Text>
      </Pressable>

      {!storeConnected && (
        <Text style={styles.setupText}>Magazinul se conectează…</Text>
      )}
      {storeConnected && !verificationReady && (
        <Text style={styles.setupText}>
          Modul de plată este integrat; serverul securizat de verificare trebuie conectat înainte de lansarea publică.
        </Text>
      )}

      <Text style={styles.legal}>
        Abonamentul se gestionează prin magazinul dispozitivului. Poți anula din setările contului de magazin, conform condițiilor platformei.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#24324a',
    borderRadius: 16,
    padding: 16,
    gap: 10,
    backgroundColor: '#0b121d',
  },
  paywall: {
    borderColor: '#5b5ee6',
  },
  eyebrow: {
    color: '#8796ad',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  title: {
    color: '#f2f6fb',
    fontSize: 19,
    fontWeight: '900',
  },
  body: {
    color: '#a7b3c5',
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#090d14',
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#56647c',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#eef2f7',
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  restoreButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  restoreText: {
    color: '#9fb6ff',
    fontWeight: '800',
  },
  setupText: {
    color: '#d6b86a',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
  legal: {
    color: '#66758c',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
});

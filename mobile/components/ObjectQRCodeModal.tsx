import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  Share,
  Platform,
} from 'react-native'
import QRCode from 'react-native-qrcode-svg'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import * as FileSystem from 'expo-file-system'
import { Asset } from 'expo-asset'
import type { Object as Obj } from '../lib/types'

const LOGO_ASSET = require('../assets/logo_vico.png')

const WEB_APP_BASE =
  (process.env.EXPO_PUBLIC_WEB_APP_URL ?? '').trim() ||
  'https://vico.example.com'

const escapeHtml = (s: string): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const getObjectUrl = (
  customerId: string,
  bvId: string,
  objectId: string
): string => {
  const base = WEB_APP_BASE.replace(/\/$/, '')
  return `${base}/kunden/${customerId}/bvs/${bvId}/objekte?objectId=${objectId}`
}

type ObjectQRCodeModalProps = {
  visible: boolean
  onClose: () => void
  object: Obj
  customerName: string
  bvName: string
  customerId: string
  bvId: string
}

const ObjectQRCodeModal = ({
  visible,
  onClose,
  object,
  customerName,
  bvName,
  customerId,
  bvId,
}: ObjectQRCodeModalProps) => {
  const [isPrinting, setIsPrinting] = useState(false)

  const url = getObjectUrl(customerId, bvId, object.id)
  const internalId = object.internal_id || object.id.slice(0, 8)
  const roomInfo = object.room ? ` · ${object.room}` : ''

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${customerName} – ${bvName}\nID: ${internalId}${roomInfo}\n${url}`,
        title: `QR-Code ${internalId}`,
        url: Platform.OS === 'ios' ? url : undefined,
      })
    } catch {
      // User cancelled or share failed
    }
  }

  const getLogoBase64 = useCallback(async (): Promise<string> => {
    try {
      const asset = Asset.fromModule(LOGO_ASSET)
      await asset.downloadAsync()
      if (asset.localUri) {
        const base64 = await FileSystem.readAsStringAsync(asset.localUri, {
          encoding: FileSystem.EncodingType.Base64,
        })
        return base64
      }
    } catch {
      // Logo nicht ladbar
    }
    return ''
  }, [])

  const handlePrint = async () => {
    setIsPrinting(true)
    try {
      const logoBase64 = await getLogoBase64()
      const logoImg = logoBase64
        ? `<img src="data:image/png;base64,${logoBase64}" alt="Vico" class="logo" />`
        : '<h1 class="brand">Vico Türen & Tore</h1>'

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, sans-serif; padding: 28px; text-align: center; color: #1e293b; }
            .logo { height: 48px; margin-bottom: 16px; object-fit: contain; }
            .brand { font-size: 20px; font-weight: 700; margin-bottom: 16px; color: #0f172a; }
            .customer { font-size: 16px; font-weight: 600; margin: 6px 0; color: #0f172a; }
            .bv { font-size: 14px; color: #475569; margin: 4px 0; }
            .id-line { font-size: 13px; color: #64748b; margin: 8px 0 16px; }
            .qr-wrap { margin: 20px auto; padding: 12px; background: #fff; }
            .qr-wrap img { display: block; margin: 0 auto; }
            .qr-label { font-size: 15px; font-weight: 600; margin-top: 16px; color: #0f172a; }
            .qr-room { font-size: 12px; color: #64748b; margin-top: 4px; }
          </style>
        </head>
        <body>
          ${logoImg}
          <p class="customer">${escapeHtml(customerName)}</p>
          <p class="bv">${escapeHtml(bvName)}</p>
          <p class="id-line">ID: ${escapeHtml(internalId)}${object.room ? ` · ${escapeHtml(object.room)}` : ''}</p>
          <div class="qr-wrap">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}" alt="QR" width="220" height="220" />
          </div>
          <p class="qr-label">${escapeHtml(internalId)}</p>
          ${object.room ? `<p class="qr-room">${escapeHtml(object.room)}</p>` : ''}
        </body>
        </html>
      `
      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      })
      const isAvailable = await Sharing.isAvailableAsync()
      if (isAvailable) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `QR-Code ${internalId} drucken`,
        })
      }
    } catch {
      // Print/Share failed
    } finally {
      setIsPrinting(false)
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={styles.content}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={styles.title}>QR-Code</Text>
          <Text style={styles.subtitle} numberOfLines={1}>
            {internalId}
          </Text>
          <View style={styles.qrContainer}>
            <QRCode value={url} size={200} quietZone={8} />
            <Text style={styles.qrLabel}>{internalId}</Text>
            <Text style={styles.qrDetail}>
              {customerName} · {bvName}
            </Text>
            {object.room && (
              <Text style={styles.qrDetail}>{object.room}</Text>
            )}
          </View>
          <View style={styles.buttons}>
            <Pressable
              style={[styles.button, styles.primaryButton]}
              onPress={handleShare}
              disabled={isPrinting}
              accessible
              accessibilityLabel="QR-Code teilen"
              accessibilityRole="button"
            >
              <Text style={styles.primaryButtonText}>Teilen</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.secondaryButton]}
              onPress={handlePrint}
              disabled={isPrinting}
              accessible
              accessibilityLabel="Als PDF drucken"
              accessibilityRole="button"
            >
              {isPrinting ? (
                <ActivityIndicator size="small" color="#0f172a" />
              ) : (
                <Text style={styles.secondaryButtonText}>Drucken</Text>
              )}
            </Pressable>
            <Pressable
              style={styles.button}
              onPress={onClose}
              accessible
              accessibilityLabel="Schließen"
              accessibilityRole="button"
            >
              <Text style={styles.closeButtonText}>Schließen</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
    width: '100%',
    textAlign: 'center',
  },
  qrContainer: {
    alignItems: 'center',
    padding: 16,
    marginBottom: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    width: '100%',
  },
  qrLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    marginTop: 12,
  },
  qrDetail: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  buttons: {
    width: '100%',
    gap: 8,
  },
  button: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  primaryButton: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#f8fafc',
  },
  secondaryButtonText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButtonText: {
    color: '#475569',
    fontSize: 16,
  },
})

export default ObjectQRCodeModal

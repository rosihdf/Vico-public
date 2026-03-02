import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useNavigation } from '@react-navigation/native'
import { supabase } from '../lib/supabase'

const OBJEKTE_PATH_REGEX =
  /\/kunden\/([a-f0-9-]+)\/bvs\/([a-f0-9-]+)\/objekte(\?.*)?$/i
const UUID_REGEX =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i

type ParsedResult =
  | { path: string }
  | { customerId: string; bvId: string; objectId?: string }

const parseScannedContent = (raw: string): ParsedResult | null => {
  const trimmed = raw.trim()
  if (!trimmed) return null

  const pathForMatch = trimmed.startsWith('/') ? trimmed : `/${trimmed}`

  try {
    if (trimmed.startsWith('http')) {
      const url = new URL(trimmed)
      const match = url.pathname.match(OBJEKTE_PATH_REGEX)
      if (match) {
        const [, customerId, bvId] = match
        const objectId = url.searchParams.get('objectId') ?? undefined
        return { customerId, bvId, objectId }
      }
    }
  } catch {
    // ignore
  }

  const relativeMatch = pathForMatch.match(OBJEKTE_PATH_REGEX)
  if (relativeMatch) {
    const [, customerId, bvId] = relativeMatch
    return { customerId, bvId }
  }

  return { path: trimmed }
}

const ScanScreen = () => {
  const navigation = useNavigation()
  const [permission, requestPermission] = useCameraPermissions()
  const [scanned, setScanned] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isResolving, setIsResolving] = useState(false)
  const lastScannedRef = useRef<string>('')

  const handleNavigateToObjekte = (
    customerId: string,
    bvId: string,
    objectId?: string
  ) => {
    setScanned(true)
    ;(navigation as { navigate: (a: string, b: object) => void }).navigate(
      'Kunden',
      {
        screen: 'Objekte',
        params: { customerId, bvId },
      }
    )
    setMessage(null)
  }

  const handleBarCodeScanned = async ({
    data,
  }: {
    type: string
    data: string
  }) => {
    if (lastScannedRef.current === data || isResolving) return
    lastScannedRef.current = data
    setIsResolving(true)
    setMessage(null)

    const parsed = parseScannedContent(data)
    if (!parsed) {
      setMessage('Unbekanntes Format.')
      setIsResolving(false)
      return
    }

    if ('path' in parsed) {
      const pathOrId = parsed.path
      if (UUID_REGEX.test(pathOrId)) {
        const { data: obj } = await supabase
          .from('objects')
          .select('id, bv_id')
          .eq('id', pathOrId)
          .single()
        if (obj) {
          const { data: bv } = await supabase
            .from('bvs')
            .select('customer_id')
            .eq('id', obj.bv_id)
            .single()
          if (bv) {
            handleNavigateToObjekte(bv.customer_id, obj.bv_id, obj.id)
            setIsResolving(false)
            return
          }
        }
        const { data: byInternalId } = await supabase
          .from('objects')
          .select('id, bv_id')
          .eq('internal_id', pathOrId)
          .maybeSingle()
        if (byInternalId) {
          const { data: bv } = await supabase
            .from('bvs')
            .select('customer_id')
            .eq('id', byInternalId.bv_id)
            .single()
          if (bv) {
            handleNavigateToObjekte(
              bv.customer_id,
              byInternalId.bv_id,
              byInternalId.id
            )
            setIsResolving(false)
            return
          }
        }
        setMessage('Objekt nicht gefunden.')
      } else {
        setMessage(`Unbekannter Inhalt: ${pathOrId}`)
      }
      setIsResolving(false)
      return
    }

    const { customerId, bvId, objectId } = parsed
    handleNavigateToObjekte(customerId, bvId, objectId)
    setIsResolving(false)
  }

  const handleStartScan = () => {
    setScanned(false)
    setMessage(null)
    lastScannedRef.current = ''
  }

  if (!permission) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    )
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>QR-Scan</Text>
        <Text style={styles.subtitle}>
          Kamerazugriff wird benötigt, um Objekt-QR-Codes zu scannen.
        </Text>
        <Pressable
          style={styles.button}
          onPress={requestPermission}
          accessible
          accessibilityLabel="Kamera-Berechtigung anfordern"
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Berechtigung anfordern</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>QR-Scan</Text>
      <Text style={styles.subtitle}>
        Scanne einen Objekt-QR-Code, um direkt zum Objekt zu gelangen.
      </Text>

      {!scanned ? (
        <View style={styles.cameraContainer}>
          <CameraView
            style={styles.camera}
            facing="back"
            onBarcodeScanned={
              isResolving ? undefined : handleBarCodeScanned
            }
            barcodeScannerSettings={{
              barcodeTypes: ['qr', 'ean13', 'code128', 'code39'],
            }}
          />
          {isResolving && (
            <View style={styles.overlay}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.overlayText}>Wird verarbeitet…</Text>
            </View>
          )}
        </View>
      ) : (
        <Pressable
          style={styles.button}
          onPress={handleStartScan}
          accessible
          accessibilityLabel="Erneut scannen"
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>Erneut scannen</Text>
        </Pressable>
      )}

      {message && (
        <View style={styles.messageBox}>
          <Text style={styles.message}>{message}</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#5b7895',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#334155',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#059669',
    padding: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  cameraContainer: {
    flex: 1,
    minHeight: 300,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 16,
  },
  messageBox: {
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  message: {
    color: '#92400e',
    fontSize: 14,
  },
})

export default ScanScreen

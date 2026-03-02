import React, { useState, useEffect, useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { fetchCustomers, fetchAllBvs, fetchAllObjects } from '../lib/dataService'
import type { Customer, BV, Object as Obj } from '../lib/types'

const matchQuery = (text: string | null, q: string): boolean => {
  if (!text) return false
  return text.toLowerCase().includes(q.toLowerCase())
}

type SearchResult =
  | { type: 'customer'; customer: Customer; customerId: string }
  | {
      type: 'bv'
      bv: BV
      customer: Customer
      customerId: string
      bvId: string
    }
  | {
      type: 'object'
      object: Obj
      bv: BV
      customer: Customer
      customerId: string
      bvId: string
      objectId: string
    }

const SucheScreen = () => {
  const navigation = useNavigation()
  const [query, setQuery] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [bvs, setBvs] = useState<BV[]>([])
  const [objects, setObjects] = useState<Obj[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setIsLoading(true)
      const [cust, bvList, objList] = await Promise.all([
        fetchCustomers(),
        fetchAllBvs(),
        fetchAllObjects(),
      ])
      setCustomers(cust ?? [])
      setBvs(bvList ?? [])
      setObjects(objList ?? [])
      setIsLoading(false)
    }
    load()
  }, [])

  const results = useMemo((): SearchResult[] => {
    const q = query.trim()
    if (!q || q.length < 2) return []

    const custList = customers
    const bvList = bvs
    const objList = objects
    const out: SearchResult[] = []

    for (const c of custList) {
      const matchName = matchQuery(c.name, q)
      const matchCity = matchQuery(c.city, q)
      const matchStreet = matchQuery(c.street, q)
      if (matchName || matchCity || matchStreet) {
        out.push({ type: 'customer', customer: c, customerId: c.id })
      }
    }

    for (const b of bvList) {
      const cust = custList.find((c) => c.id === b.customer_id)
      if (!cust) continue
      const matchName = matchQuery(b.name, q)
      const matchCity = matchQuery(b.city, q)
      const matchStreet = matchQuery(b.street, q)
      if (matchName || matchCity || matchStreet) {
        out.push({ type: 'bv', bv: b, customer: cust, customerId: cust.id, bvId: b.id })
      }
    }

    for (const o of objList) {
      const b = bvList.find((bv) => bv.id === o.bv_id)
      const cust = b ? custList.find((c) => c.id === b.customer_id) : null
      if (!b || !cust) continue
      const matchId = matchQuery(o.internal_id, q)
      const matchRoom = matchQuery(o.room, q)
      const matchFloor = matchQuery(o.floor, q)
      const matchManufacturer = matchQuery(o.manufacturer, q)
      const matchBuildYear = matchQuery(o.build_year, q)
      if (matchId || matchRoom || matchFloor || matchManufacturer || matchBuildYear) {
        out.push({
          type: 'object',
          object: o,
          bv: b,
          customer: cust,
          customerId: cust.id,
          bvId: b.id,
          objectId: o.id,
        })
      }
    }
    return out
  }, [query, customers, bvs, objects])

  const handleNavigateToResult = (item: SearchResult) => {
    if (item.type === 'customer') {
      ;(navigation as { navigate: (a: string, b: object) => void }).navigate(
        'Main',
        { screen: 'Kunden', params: { screen: 'BVs', params: { customerId: item.customerId } } }
      )
    } else if (item.type === 'bv') {
      ;(navigation as { navigate: (a: string, b: object) => void }).navigate(
        'Main',
        { screen: 'Kunden', params: { screen: 'Objekte', params: { customerId: item.customerId, bvId: item.bvId } } }
      )
    } else {
      ;(navigation as { navigate: (a: string, b: object) => void }).navigate(
        'Main',
        { screen: 'Kunden', params: { screen: 'Objekte', params: { customerId: item.customerId, bvId: item.bvId } } }
      )
    }
  }

  const renderResult = ({ item }: { item: SearchResult }) => {
    if (item.type === 'customer') {
      return (
        <Pressable
          style={styles.card}
          onPress={() => handleNavigateToResult(item)}
          accessible
          accessibilityLabel={`Kunde ${item.customer.name}`}
        >
          <Text style={styles.badge}>Kunde</Text>
          <Text style={styles.name}>{item.customer.name}</Text>
          {(item.customer.city || item.customer.street) && (
            <Text style={styles.detail}>
              {[item.customer.street, item.customer.city].filter(Boolean).join(', ')}
            </Text>
          )}
        </Pressable>
      )
    }
    if (item.type === 'bv') {
      return (
        <Pressable
          style={styles.card}
          onPress={() => handleNavigateToResult(item)}
          accessible
          accessibilityLabel={`BV ${item.bv.name}`}
        >
          <Text style={styles.badge}>BV</Text>
          <Text style={styles.name}>{item.bv.name}</Text>
          <Text style={styles.detail}>{item.customer.name}</Text>
        </Pressable>
      )
    }
    return (
      <Pressable
        style={styles.card}
        onPress={() => handleNavigateToResult(item)}
        accessible
        accessibilityLabel={`Objekt ${item.object.internal_id || item.object.id}`}
      >
        <Text style={styles.badge}>Objekt</Text>
        <Text style={styles.name}>{item.object.internal_id || item.object.id}</Text>
        <Text style={styles.detail}>
          {[item.object.room, item.object.floor].filter(Boolean).join(' · ') ||
            item.object.manufacturer ||
            item.bv.name}
        </Text>
        <Text style={styles.subdetail}>{item.customer.name} → {item.bv.name}</Text>
      </Pressable>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Suche</Text>
      <Text style={styles.subtitle}>
        Durchsuche Kunden, BVs und Objekte (min. 2 Zeichen).
      </Text>

      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder="Name, Ort, interne ID, Raum…"
        placeholderTextColor="#94a3b8"
        autoCapitalize="none"
        autoCorrect={false}
        accessible
        accessibilityLabel="Suchbegriff"
      />

      {isLoading ? (
        <ActivityIndicator size="large" color="#059669" style={styles.loader} />
      ) : query.trim().length >= 2 ? (
        results.length === 0 ? (
          <Text style={styles.empty}>Keine Treffer.</Text>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) =>
              item.type === 'customer'
                ? `cust-${item.customer.id}`
                : item.type === 'bv'
                  ? `bv-${item.bv.id}`
                  : `obj-${item.object.id}`
            }
            renderItem={renderResult}
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
          />
        )
      ) : (
        <Text style={styles.hint}>Tippe mindestens 2 Zeichen ein.</Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#5b7895',
    padding: 24,
    paddingBottom: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#0f172a',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  loader: {
    marginTop: 32,
  },
  list: {
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  badge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  detail: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  subdetail: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
  empty: {
    color: '#64748b',
    marginTop: 24,
    fontSize: 16,
  },
  hint: {
    color: '#94a3b8',
    marginTop: 16,
    fontSize: 14,
  },
})

export default SucheScreen

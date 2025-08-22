import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = 'https://riveraproject-5.onrender.com';

const CotizacionesScreen = () => {
  const [data, setData] = useState([]);
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchCotizaciones = useCallback(async (pageToLoad = 1, replace = false) => {
    try {
      if (pageToLoad === 1 && !replace) setLoading(true);
      setError(null);

      const token = await AsyncStorage.getItem('authToken');
      const url = `${API_BASE}/api/cotizaciones?page=${pageToLoad}&limit=10&sortBy=createdAt&sortOrder=desc`;

      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt}`);
      }

      const json = await res.json();
      const items = Array.isArray(json.data) ? json.data : [];

      setData(prev => (replace || pageToLoad === 1 ? items : [...prev, ...items]));
      setHasNextPage(json?.pagination?.hasNextPage === true);
      setPage(pageToLoad);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCotizaciones(1, true);
  }, [fetchCotizaciones]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCotizaciones(1, true);
  };

  const loadMore = async () => {
    if (loading || !hasNextPage) return;
    await fetchCotizaciones(page + 1);
  };

  const renderItem = ({ item }) => {
    const cliente = item?.clientId;
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{item.quoteName}</Text>
        <Text style={styles.subtitle}>{item.quoteDescription}</Text>
        <Text style={styles.row}>Precio: ${item.price}</Text>
        <Text style={styles.row}>Estado: {item.status}</Text>
        {cliente ? (
          <Text style={styles.row}>Cliente: {cliente.name} · {cliente.email}</Text>
        ) : null}
        <Text style={styles.footer}>Entrega: {new Date(item.deliveryDate).toLocaleDateString('es-ES')}</Text>
      </View>
    );
  };

  if (loading && data.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Cargando cotizaciones...</Text>
      </View>
    );
  }

  if (error && data.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>No se pudieron cargar las cotizaciones</Text>
        <Text style={styles.small}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={data}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.2}
        ListFooterComponent={hasNextPage ? (
          <View style={styles.footerLoader}>
            <ActivityIndicator size="small" color="#4CAF50" />
            <Text style={styles.small}>Cargando más...</Text>
          </View>
        ) : null}
        contentContainerStyle={{ padding: 16 }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 12,
    color: '#666'
  },
  error: {
    color: '#d32f2f',
    fontSize: 16,
    fontWeight: '600'
  },
  small: {
    color: '#666',
    marginTop: 6
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 10,
  },
  row: {
    fontSize: 13,
    marginBottom: 4,
  },
  footer: {
    marginTop: 8,
    fontSize: 12,
    color: '#888'
  },
  footerLoader: {
    alignItems: 'center',
    paddingVertical: 12
  }
});

export default CotizacionesScreen;
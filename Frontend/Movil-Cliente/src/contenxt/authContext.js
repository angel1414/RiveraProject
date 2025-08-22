// src/context/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

// Crear el contexto
const AuthContext = createContext();

// ⏰ CONFIGURACIÓN DE EXPIRACIÓN PARA CLIENTES
const SESSION_TIMEOUT = 20 * 60 * 1000; // 20 minutos en milisegundos

// Provider del contexto
export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userType, setUserType] = useState(null);
  const [user, setUser] = useState(null);
  const [sessionTimer, setSessionTimer] = useState(null);
  const [token, setToken] = useState(null);

  useEffect(() => {
    checkAuthStatus();
    
    // Cleanup del timer cuando se desmonta el componente
    return () => {
      if (sessionTimer) {
        clearTimeout(sessionTimer);
      }
    };
  }, []);

  // 🔍 VERIFICAR SI HAY UNA SESIÓN GUARDADA
  const checkAuthStatus = async () => {
    try {
      console.log('🔍 Verificando sesión de cliente guardada...');
      
      const storedToken = await AsyncStorage.getItem('clientToken');
      const loginTime = await AsyncStorage.getItem('clientLoginTime');
      const onboardingCompleted = await AsyncStorage.getItem('onboardingCompleted');
      const userData = await AsyncStorage.getItem('clientData');
      const savedUserType = await AsyncStorage.getItem('clientUserType');
      const clientId = await AsyncStorage.getItem('clientId');

      if (storedToken && loginTime) {
        const currentTime = Date.now();
        const timeSinceLogin = currentTime - parseInt(loginTime);
        
        console.log(`⏰ Tiempo desde login: ${Math.round(timeSinceLogin / 1000 / 60)} minutos`);
        
        // ✅ SI EL TOKEN NO HA EXPIRADO
        if (timeSinceLogin < SESSION_TIMEOUT) {
          const remainingTime = SESSION_TIMEOUT - timeSinceLogin;
          console.log(`✅ Sesión válida. Expira en: ${Math.round(remainingTime / 1000 / 60)} minutos`);
          console.log(`📋 Cliente ID guardado: ${clientId}`);
          
          // VALIDAR QUE SEA CLIENTE
          if (savedUserType !== 'Cliente') {
            console.log('🚫 Usuario no es cliente - cerrando sesión');
            await clearAuthData();
            setIsLoading(false);
            return;
          }
          
          // Restaurar estado
          setIsAuthenticated(true);
          setHasCompletedOnboarding(onboardingCompleted === 'true');
          setUser(userData ? JSON.parse(userData) : null);
          setUserType(savedUserType);
          setToken(storedToken);
          
          // Programar auto-logout
          startSessionTimer(remainingTime);
        } else {
          // ❌ TOKEN EXPIRADO
          console.log('❌ Sesión expirada - limpiando datos');
          await clearAuthData();
          
          // Notificar al usuario que la sesión expiró
          Alert.alert(
            '⏰ Sesión Expirada',
            'Tu sesión ha expirado por seguridad. Por favor inicia sesión nuevamente.',
            [{ text: 'OK' }]
          );
        }
      } else {
        console.log('📭 No hay sesión de cliente guardada');
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('❌ Error verificando sesión:', error);
      await clearAuthData();
      setIsLoading(false);
    }
  };

  // ⏲️ INICIAR TIMER DE SESIÓN
  const startSessionTimer = (timeoutDuration = SESSION_TIMEOUT) => {
    // Limpiar timer anterior si existe
    if (sessionTimer) {
      clearTimeout(sessionTimer);
    }

    const timer = setTimeout(async () => {
      console.log('⏰ Sesión de cliente expirada automáticamente');
      await autoLogout();
    }, timeoutDuration);

    setSessionTimer(timer);
    console.log(`⏰ Timer de cliente iniciado: ${Math.round(timeoutDuration / 1000 / 60)} minutos`);
  };

  // 🚪 AUTO-LOGOUT POR EXPIRACIÓN
  const autoLogout = async () => {
    try {
      console.log('🔒 Cerrando sesión automáticamente por expiración');
      await clearAuthData();
      
      Alert.alert(
        '⏰ Sesión Expirada', 
        'Tu sesión ha expirado por seguridad. Por favor inicia sesión nuevamente.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('❌ Error en auto-logout:', error);
    }
  };

  // 🗑️ LIMPIAR TODOS LOS DATOS DE AUTENTICACIÓN
  const clearAuthData = async () => {
    try {
      await AsyncStorage.multiRemove([
        'clientToken',
        'clientLoginTime', 
        'onboardingCompleted',
        'clientData',
        'clientUserType',
        'clientId',
        'authToken' // Para compatibilidad
      ]);
      
      setIsAuthenticated(false);
      setHasCompletedOnboarding(false);
      setUserType(null);
      setUser(null);
      setToken(null);
      
      if (sessionTimer) {
        clearTimeout(sessionTimer);
        setSessionTimer(null);
      }
      
      console.log('🧹 Datos de cliente limpiados');
    } catch (error) {
      console.error('❌ Error limpiando datos:', error);
    }
  };

  // 🔐 LOGIN CON PERSISTENCIA (SOLO CLIENTES)
  const login = async (loginData) => {
    try {
      console.log('🔐 Procesando login de cliente:', loginData);
      
      // VALIDAR QUE SEA CLIENTE
      if (loginData.userType !== 'Cliente') {
        console.log('🚫 Usuario no es cliente:', loginData.userType);
        return { 
          success: false, 
          error: `Acceso denegado. Esta aplicación es solo para clientes. Tu tipo: ${loginData.userType}` 
        };
      }
      
      const currentTime = Date.now();
      const userId = loginData.user._id || loginData.user.id;
      
      if (!userId) {
        console.error('❌ No se encontró ID del cliente');
        throw new Error('ID de cliente no disponible');
      }
      
      // 💾 GUARDAR EN ASYNCSTORAGE
      await AsyncStorage.multiSet([
        ['clientToken', loginData.token || 'temp-client-token'],
        ['authToken', loginData.token || ''], // Para compatibilidad
        ['clientLoginTime', currentTime.toString()],
        ['clientData', JSON.stringify(loginData.user)],
        ['clientUserType', loginData.userType],
        ['clientId', userId.toString()],
        ['onboardingCompleted', 'true'] // Los clientes que hacen login ya pasaron onboarding
      ]);
      
      // 📱 ACTUALIZAR ESTADO
      setUser(loginData.user);
      setUserType(loginData.userType);
      setIsAuthenticated(true);
      setHasCompletedOnboarding(true);
      setToken(loginData.token || 'temp-client-token');
      
      // ⏰ INICIAR TIMER DE EXPIRACIÓN
      startSessionTimer();
      
      console.log('✅ Login de cliente completado y guardado');
      console.log('📋 Cliente ID guardado:', userId);
      console.log('📊 Sesión expirará en 20 minutos');
      
      return { success: true };
    } catch (error) {
      console.error('❌ Login error:', error);
      return { success: false, error };
    }
  };

  // 📝 REGISTRO (USUARIOS NUEVOS - SOLO CLIENTES)
  const register = async (userData) => {
    try {
      console.log('📝 Registrando nuevo cliente');
      
      // VALIDAR QUE SEA CLIENTE
      if (userData.userType && userData.userType !== 'Cliente') {
        return { 
          success: false, 
          error: `Solo se pueden registrar clientes en esta aplicación` 
        };
      }
      
      const currentTime = Date.now();
      const userId = userData._id || userData.id;
      
      if (!userId) {
        console.error('❌ No se encontró ID del cliente en registro');
        throw new Error('ID de cliente no disponible');
      }
      
      // 💾 GUARDAR EN ASYNCSTORAGE
      await AsyncStorage.multiSet([
        ['clientToken', 'temp-register-token'],
        ['authToken', ''], // Para compatibilidad
        ['clientLoginTime', currentTime.toString()],
        ['clientData', JSON.stringify(userData)],
        ['clientUserType', 'Cliente'],
        ['clientId', userId.toString()],
        ['onboardingCompleted', 'false'] // Usuarios nuevos SÍ necesitan onboarding
      ]);
      
      // 📱 ACTUALIZAR ESTADO
      setUser(userData);
      setUserType('Cliente');
      setIsAuthenticated(true);
      setHasCompletedOnboarding(false); // Mostrar onboarding para nuevos usuarios
      setToken('temp-register-token');
      
      // ⏰ INICIAR TIMER DE EXPIRACIÓN
      startSessionTimer();
      
      console.log('📊 Registro de cliente completado');
      console.log('📋 Cliente ID guardado:', userId);
      
      return { success: true };
    } catch (error) {
      console.error('❌ Register error:', error);
      return { success: false, error };
    }
  };

  // 🎉 COMPLETAR ONBOARDING
  const completeOnboarding = async () => {
    try {
      await AsyncStorage.setItem('onboardingCompleted', 'true');
      setHasCompletedOnboarding(true);
      console.log('🎉 Onboarding de cliente completado');
      return { success: true };
    } catch (error) {
      console.error('❌ Complete onboarding error:', error);
      return { success: false, error };
    }
  };

  // 🚪 LOGOUT MANUAL
  const logout = async () => {
    try {
      console.log('👋 Logout manual de cliente');
      await clearAuthData();
      return { success: true };
    } catch (error) {
      console.error('❌ Logout error:', error);
      return { success: false, error };
    }
  };

  // 🔄 RENOVAR SESIÓN (para extender tiempo)
  const refreshSession = async () => {
    try {
      const currentTime = Date.now();
      await AsyncStorage.setItem('clientLoginTime', currentTime.toString());
      startSessionTimer(); // Reiniciar timer
      console.log('🔄 Sesión de cliente renovada por 20 minutos más');
      return { success: true };
    } catch (error) {
      console.error('❌ Error renovando sesión:', error);
      return { success: false };
    }
  };

  // ⏰ OBTENER TIEMPO RESTANTE DE SESIÓN
  const getRemainingTime = async () => {
    try {
      const loginTime = await AsyncStorage.getItem('clientLoginTime');
      if (loginTime) {
        const currentTime = Date.now();
        const timeSinceLogin = currentTime - parseInt(loginTime);
        const remainingTime = Math.max(0, SESSION_TIMEOUT - timeSinceLogin);
        const remainingMinutes = Math.round(remainingTime / 1000 / 60);
        return remainingMinutes;
      }
      return 0;
    } catch (error) {
      console.error('❌ Error obteniendo tiempo restante:', error);
      return 0;
    }
  };

  const value = {
    isAuthenticated,
    hasCompletedOnboarding,
    isLoading,
    userType,
    user,
    token,
    login,
    register,
    completeOnboarding,
    logout,
    refreshSession,
    getRemainingTime, // Para mostrar tiempo restante en UI
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook para usar el contexto
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de AuthProvider');
  }
  return context;
};

export default AuthContext;
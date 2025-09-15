import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import api from '../services/api';

export const useMachinePermissions = () => {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Carregar permissões do usuário
  const loadUserPermissions = useCallback(async () => {
    console.log('🔄 useMachinePermissions: loadUserPermissions chamado', { userId: user?.id, role: user?.role });
    
    if (!user?.id || !isAuthenticated) {
      console.log('❌ useMachinePermissions: Usuário não autenticado ou sem ID');
      setPermissions([]);
      setLoading(false);
      return;
    }

    // Admins e Managers têm acesso a todas as máquinas
    if (['ADMIN', 'MANAGER'].includes(user.role)) {
      console.log('✅ useMachinePermissions: Usuário é ADMIN/MANAGER - sem filtro');
      setPermissions([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('📡 useMachinePermissions: Fazendo chamada para API de permissões');
      const response = await api.get(`/permissions?userId=${user.id}`);
      const userPermissions = response.data.data || [];
      
      console.log('✅ useMachinePermissions: Permissões carregadas:', userPermissions.length);
      setPermissions(userPermissions);
    } catch (err) {
      console.error('❌ useMachinePermissions: Erro ao carregar permissões do usuário:', err);
      // Se for erro de token inválido, não mostrar erro para o usuário
      if (err.response?.status === 401) {
        console.log('🔒 useMachinePermissions: Token inválido - usuário será redirecionado');
        setError(null);
      } else {
        setError('Erro ao carregar permissões');
      }
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, user?.role, isAuthenticated]);

  // Carregar permissões quando o usuário mudar e estiver autenticado
  useEffect(() => {
    if (isAuthenticated && !authLoading && user?.id) {
      loadUserPermissions();
    }
  }, [loadUserPermissions, isAuthenticated, authLoading, user?.id]);

  // Verificar se o usuário tem permissão para uma máquina específica
  const hasPermissionForMachine = useCallback((machineId, permissionType = 'canView') => {
    if (!user) {
      return false;
    }
    
    // Admins e Managers têm acesso total
    if (['ADMIN', 'MANAGER'].includes(user.role)) {
      return true;
    }

    // Verificar permissões específicas do operador
    const permission = permissions.find(p => p.machineId === machineId);
    const hasPermission = permission ? permission[permissionType] : false;
    
    return hasPermission;
  }, [user, permissions]);

  // Filtrar máquinas baseado nas permissões do usuário
  const filterMachinesByPermissions = useCallback((machines, permissionType = 'canView') => {
    console.log('🔍 useMachinePermissions: filterMachinesByPermissions chamado', { 
      machinesCount: machines?.length, 
      userRole: user?.role,
      permissionsCount: permissions?.length,
      permissionType 
    });
    
    if (!user) {
      console.log('❌ useMachinePermissions: Usuário não encontrado');
      return [];
    }
    
    // Admins e Managers veem todas as máquinas
    if (['ADMIN', 'MANAGER'].includes(user.role)) {
      console.log('✅ useMachinePermissions: Usuário ADMIN/MANAGER - retornando todas as máquinas:', machines?.length);
      return machines;
    }

    // Filtrar máquinas para operadores baseado em suas permissões
    const filteredMachines = machines.filter(machine => {
      const hasPermission = hasPermissionForMachine(machine.id, permissionType);
      console.log(`🔍 useMachinePermissions: Máquina ${machine.id} (${machine.name}) - Permissão ${permissionType}: ${hasPermission}`);
      return hasPermission;
    });
    
    console.log('✅ useMachinePermissions: Máquinas filtradas:', filteredMachines.length);
    return filteredMachines;
  }, [user, hasPermissionForMachine, permissions]);

  // Obter lista de IDs de máquinas que o usuário pode acessar
  const getAccessibleMachineIds = useCallback((permissionType = 'canView') => {
    if (!user) return [];
    
    // Admins e Managers têm acesso a todas (retorna array vazio para indicar "todas")
    if (['ADMIN', 'MANAGER'].includes(user.role)) {
      return [];
    }

    // Retornar IDs das máquinas que o operador pode acessar
    return permissions
      .filter(p => p[permissionType])
      .map(p => p.machineId);
  }, [user, permissions]);

  // Verificar se o usuário tem pelo menos uma permissão
  const hasAnyMachinePermission = useCallback(() => {
    if (!user) {
      return false;
    }
    
    // Admins e Managers sempre têm permissão
    if (['ADMIN', 'MANAGER'].includes(user.role)) {
      return true;
    }

    // Para operadores, verificar se tem pelo menos uma permissão
    return permissions.length > 0;
  }, [user, permissions]);

  // Obter estatísticas de permissões
  const getPermissionStats = useCallback(() => {
    if (!user) return { total: 0, canView: 0, canOperate: 0, canEdit: 0 };
    
    // Admins e Managers têm acesso total (não calculamos estatísticas)
    if (['ADMIN', 'MANAGER'].includes(user.role)) {
      return { total: -1, canView: -1, canOperate: -1, canEdit: -1 }; // -1 indica "todas"
    }

    return {
      total: permissions.length,
      canView: permissions.filter(p => p.canView).length,
      canOperate: permissions.filter(p => p.canOperate).length,
      canEdit: permissions.filter(p => p.canEdit).length
    };
  }, [user, permissions]);

  // Recarregar permissões
  const refreshPermissions = useCallback(() => {
    loadUserPermissions();
  }, [loadUserPermissions]);

  return {
    permissions,
    loading,
    error,
    hasPermissionForMachine,
    filterMachinesByPermissions,
    getAccessibleMachineIds,
    hasAnyMachinePermission,
    getPermissionStats,
    refreshPermissions
  };
};

export default useMachinePermissions;
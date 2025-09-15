import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { UserIcon, CogIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import api from '@/services/api';

const OperatorAssignment = () => {
  const { user } = useAuth();
  const [machines, setMachines] = useState([]);
  const [operators, setOperators] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Verificar se o usuário tem permissão para gerenciar operadores
  const canManageOperators = ['ADMIN', 'MANAGER'].includes(user?.role);

  useEffect(() => {
    if (!canManageOperators) {
      setError('Você não tem permissão para acessar esta página');
      setLoading(false);
      return;
    }
    
    loadData();
  }, [canManageOperators]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Carregar máquinas, operadores e permissões em paralelo
      const [machinesRes, operatorsRes, permissionsRes] = await Promise.all([
        api.get('/machines'),
        api.get('/users?role=OPERATOR'),
        api.get('/permissions')
      ]);

      // Verificar se todas as respostas foram bem-sucedidas
      if (!machinesRes.data.success || !operatorsRes.data.success || !permissionsRes.data.success) {
        throw new Error('Erro ao carregar dados');
      }

      // Extrair dados das respostas
      setMachines(machinesRes.data.data || []);
      setOperators(operatorsRes.data.data || []);
      setPermissions(permissionsRes.data.data || []);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      setError('Erro ao carregar dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const updatePermission = async (operatorId, machineId, permissionType, value) => {
    try {
      setSaving(true);
      
      // Encontrar permissão existente
      const existingPermission = permissions.find(
        p => p.userId === operatorId && p.machineId === machineId
      );

      if (existingPermission) {
        // Atualizar permissão existente
        await api.put(`/permissions/${existingPermission.id}`, {
          canView: permissionType === 'canView' ? value : existingPermission.canView,
          canOperate: permissionType === 'canOperate' ? value : existingPermission.canOperate,
          canEdit: permissionType === 'canEdit' ? value : existingPermission.canEdit
        });
      } else {
        // Criar nova permissão
        await api.post('/permissions', {
          userId: operatorId,
          machineId: machineId,
          canView: permissionType === 'canView' ? value : false,
          canOperate: permissionType === 'canOperate' ? value : true, // Operadores sempre podem operar
          canEdit: permissionType === 'canEdit' ? value : false
        });
      }

      // Recarregar dados
      await loadData();
    } catch (err) {
      console.error('Erro ao atualizar permissão:', err);
      alert('Erro ao atualizar permissão. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const hasPermission = (operatorId, machineId, permissionType) => {
    const permission = permissions.find(
      p => p.userId === operatorId && p.machineId === machineId
    );
    return permission ? permission[permissionType] : false;
  };

  const filteredMachines = machines.filter(machine =>
    machine.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    machine.location?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!canManageOperators) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <XMarkIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Acesso Negado
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Você não tem permissão para acessar esta página.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <XMarkIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Erro
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Atribuição de Operadores
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Gerencie quais operadores podem acessar e operar cada máquina.
          </p>
        </div>

        {/* Filtros */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Buscar máquinas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <CogIcon className="h-8 w-8 text-blue-500 mr-3" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total de Máquinas</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{machines.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <UserIcon className="h-8 w-8 text-green-500 mr-3" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Operadores</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{operators.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <CheckIcon className="h-8 w-8 text-purple-500 mr-3" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Permissões Ativas</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{permissions.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabela de Permissões */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Matriz de Permissões
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Clique nas células para alterar as permissões dos operadores.
            </p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Máquina
                  </th>
                  {operators.map(operator => (
                    <th key={operator.id} className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium mb-1">
                          {operator.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                        </div>
                        <span className="text-xs">{operator.name.split(' ')[0]}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredMachines.map(machine => (
                  <tr key={machine.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {machine.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          {machine.location || 'Localização não definida'}
                        </div>
                      </div>
                    </td>
                    {operators.map(operator => (
                      <td key={`${machine.id}-${operator.id}`} className="px-3 py-4 text-center">
                        <button
                          onClick={() => updatePermission(
                            operator.id, 
                            machine.id, 
                            'canOperate', 
                            !hasPermission(operator.id, machine.id, 'canOperate')
                          )}
                          disabled={saving}
                          className={cn(
                            'w-8 h-8 rounded-full border-2 transition-all duration-200 hover:scale-110',
                            hasPermission(operator.id, machine.id, 'canOperate')
                              ? 'bg-green-500 border-green-500 text-white'
                              : 'bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-500 text-gray-400 dark:text-gray-300',
                            saving && 'opacity-50 cursor-not-allowed'
                          )}
                          title={`${hasPermission(operator.id, machine.id, 'canOperate') ? 'Remover' : 'Conceder'} permissão de operação para ${operator.name} na máquina ${machine.name}`}
                        >
                          {hasPermission(operator.id, machine.id, 'canOperate') && (
                            <CheckIcon className="h-4 w-4 mx-auto" />
                          )}
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legenda */}
        <div className="mt-6 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Legenda:</h3>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-green-500 rounded-full mr-2"></div>
              <span className="text-gray-600 dark:text-gray-400">Pode operar a máquina</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded-full mr-2"></div>
              <span className="text-gray-600 dark:text-gray-400">Não pode operar a máquina</span>
            </div>
          </div>
        </div>

        {operators.length === 0 && (
          <div className="text-center py-12">
            <UserIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Nenhum operador encontrado
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Cadastre operadores no sistema para poder atribuí-los às máquinas.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OperatorAssignment;
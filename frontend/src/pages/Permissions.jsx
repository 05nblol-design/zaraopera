import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Users,
  Settings,
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  Eye,
  Play,
  AlertCircle,
  CheckCircle,
  X,
  Save,
  UserCheck,
  Cog
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import api from '@/services/api';

const Permissions = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Estados principais
  const [permissions, setPermissions] = useState([]);
  const [operators, setOperators] = useState([]);
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Estados de filtros e busca
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOperator, setSelectedOperator] = useState('');
  const [selectedMachine, setSelectedMachine] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalPermissions, setTotalPermissions] = useState(0);
  
  // Estados do modal
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create'); // 'create' | 'edit' | 'bulk'
  const [selectedPermission, setSelectedPermission] = useState(null);
  const [formData, setFormData] = useState({
    userId: '',
    machineId: '',
    canView: true,
    canOperate: false,
    canEdit: false
  });
  
  // Estados de carregamento
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(null);

  // Verificar permissões de acesso
  useEffect(() => {
    if (!user) {
      return;
    }
    
    if (!['MANAGER', 'ADMIN'].includes(user?.role)) {
      navigate('/dashboard');
      return;
    }
  }, [user, navigate]);

  // Carregar dados iniciais
  useEffect(() => {
    loadInitialData();
  }, []);

  // Carregar permissões quando filtros mudarem
  useEffect(() => {
    loadPermissions();
  }, [currentPage, searchTerm, selectedOperator, selectedMachine]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [operatorsRes, machinesRes] = await Promise.all([
        api.get('/permissions/operators'),
        api.get('/permissions/machines')
      ]);
      
      setOperators(operatorsRes.data.data || []);
      setMachines(machinesRes.data.data || []);
    } catch (err) {
      console.error('Erro ao carregar dados iniciais:', err);
      setError('Erro ao carregar dados iniciais');
    } finally {
      setLoading(false);
    }
  };

  const loadPermissions = async () => {
    try {
      const params = {
        page: currentPage,
        limit: 10,
        ...(searchTerm && { search: searchTerm }),
        ...(selectedOperator && { userId: selectedOperator }),
        ...(selectedMachine && { machineId: selectedMachine })
      };

      const response = await api.get('/permissions', { params });
      const { data, pagination } = response.data;
      
      setPermissions(data || []);
      setTotalPages(pagination?.totalPages || 1);
      setTotalPermissions(pagination?.total || 0);
    } catch (err) {
      console.error('Erro ao carregar permissões:', err);
      setError('Erro ao carregar permissões');
    }
  };

  const handleSearch = (value) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const handleOperatorFilter = (value) => {
    setSelectedOperator(value);
    setCurrentPage(1);
  };

  const handleMachineFilter = (value) => {
    setSelectedMachine(value);
    setCurrentPage(1);
  };

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedPermission(null);
    setFormData({
      userId: '',
      machineId: '',
      canView: true,
      canOperate: false,
      canEdit: false
    });
    setShowModal(true);
  };

  const openEditModal = (permission) => {
    setModalMode('edit');
    setSelectedPermission(permission);
    setFormData({
      userId: permission.userId,
      machineId: permission.machineId,
      canView: permission.canView,
      canOperate: permission.canOperate,
      canEdit: permission.canEdit
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedPermission(null);
    setFormData({
      userId: '',
      machineId: '',
      canView: true,
      canOperate: false,
      canEdit: false
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validações mais robustas
    if (!formData.userId || formData.userId === '') {
      setError('Selecione um usuário');
      return;
    }
    
    if (!formData.machineId || formData.machineId === '') {
      setError('Selecione uma máquina');
      return;
    }
    
    // Validar se pelo menos uma permissão está ativa
    if (!formData.canView && !formData.canOperate && !formData.canEdit) {
      setError('Pelo menos uma permissão deve estar ativa');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      if (modalMode === 'create') {
        const response = await api.post('/permissions', {
          userId: parseInt(formData.userId),
          machineId: parseInt(formData.machineId),
          canView: formData.canView,
          canOperate: formData.canOperate,
          canEdit: formData.canEdit
        });
        
        if (!response.data.success) {
          throw new Error(response.data.message || 'Erro ao criar permissão');
        }
      } else if (modalMode === 'edit') {
        const response = await api.put(`/permissions/${selectedPermission.id}`, {
          canView: formData.canView,
          canOperate: formData.canOperate,
          canEdit: formData.canEdit
        });
        
        if (!response.data.success) {
          throw new Error(response.data.message || 'Erro ao atualizar permissão');
        }
      }

      await loadPermissions();
      closeModal();
    } catch (err) {
      console.error('Erro ao salvar permissão:', err);
      const errorMessage = err.response?.data?.message || err.message || 'Erro ao salvar permissão';
      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (permissionId) => {
    if (!window.confirm('Tem certeza que deseja remover esta permissão?')) {
      return;
    }

    try {
      setDeleting(permissionId);
      await api.delete(`/permissions/${permissionId}`);
      await loadPermissions();
    } catch (err) {
      console.error('Erro ao remover permissão:', err);
      setError(err.response?.data?.message || 'Erro ao remover permissão');
    } finally {
      setDeleting(null);
    }
  };

  const getPermissionBadges = (permission) => {
    const badges = [];
    if (permission.canView) badges.push({ label: 'Visualizar', color: 'bg-blue-100 text-blue-800', icon: Eye });
    if (permission.canOperate) badges.push({ label: 'Operar', color: 'bg-green-100 text-green-800', icon: Play });
    if (permission.canEdit) badges.push({ label: 'Editar', color: 'bg-purple-100 text-purple-800', icon: Edit });
    return badges;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Permissões - ZARA</title>
        <meta name="description" content="Gerenciar permissões de operadores para máquinas" />
      </Helmet>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Permissões
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Gerencie as permissões de operadores para máquinas
                </p>
              </div>
            </div>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nova Permissão
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Busca */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por usuário ou máquina..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {/* Filtro por Operador */}
            <select
              value={selectedOperator}
              onChange={(e) => handleOperatorFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Todos os operadores</option>
              {operators.map(operator => (
                <option key={operator.id} value={operator.id}>
                  {operator.name} ({operator.badgeNumber})
                </option>
              ))}
            </select>

            {/* Filtro por Máquina */}
            <select
              value={selectedMachine}
              onChange={(e) => handleMachineFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Todas as máquinas</option>
              {machines.map(machine => (
                <option key={machine.id} value={machine.id}>
                  {machine.name} ({machine.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Mensagem de erro */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          </div>
        )}

        {/* Lista de Permissões */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Permissões Cadastradas
              </h2>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {totalPermissions} permissões encontradas
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Operador
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Máquina
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Permissões
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Concedida em
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {permissions.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center gap-2">
                        <Shield className="h-12 w-12 text-gray-400" />
                        <p className="text-gray-500 dark:text-gray-400">
                          Nenhuma permissão encontrada
                        </p>
                        <button
                          onClick={openCreateModal}
                          className="mt-2 text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Criar primeira permissão
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  permissions.map((permission) => (
                    <tr key={permission.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-full">
                            <UserCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {permission.user.name}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {permission.user.badgeNumber} • {permission.user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-full">
                            <Cog className="h-4 w-4 text-green-600 dark:text-green-400" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {permission.machine.name}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {permission.machine.code} • {permission.machine.location}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-1">
                          {getPermissionBadges(permission).map((badge, index) => {
                            const IconComponent = badge.icon;
                            return (
                              <span
                                key={index}
                                className={cn(
                                  'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium',
                                  badge.color
                                )}
                              >
                                <IconComponent className="h-3 w-3" />
                                {badge.label}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(permission.grantedAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(permission)}
                            className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="Editar permissão"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(permission.id)}
                            disabled={deleting === permission.id}
                            className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                            title="Remover permissão"
                          >
                            {deleting === permission.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-700 dark:text-gray-300">
                  Página {currentPage} de {totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Modal de Criação/Edição */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {modalMode === 'create' ? 'Nova Permissão' : 'Editar Permissão'}
                </h3>
                <button
                  onClick={closeModal}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Seleção de Operador */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Operador *
                  </label>
                  <select
                    value={formData.userId}
                    onChange={(e) => setFormData(prev => ({ ...prev, userId: parseInt(e.target.value) }))}
                    disabled={modalMode === 'edit'}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                  >
                    <option value="">Selecione um operador</option>
                    {operators.map(operator => (
                      <option key={operator.id} value={operator.id}>
                        {operator.name} ({operator.badgeNumber})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Seleção de Máquina */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Máquina *
                  </label>
                  <select
                    value={formData.machineId}
                    onChange={(e) => setFormData(prev => ({ ...prev, machineId: parseInt(e.target.value) }))}
                    disabled={modalMode === 'edit'}
                    required
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                  >
                    <option value="">Selecione uma máquina</option>
                    {machines.map(machine => (
                      <option key={machine.id} value={machine.id}>
                        {machine.name} ({machine.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Permissões */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Permissões
                  </label>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={formData.canView}
                        onChange={(e) => setFormData(prev => ({ ...prev, canView: e.target.checked }))}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-blue-600" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Visualizar - Pode ver informações da máquina
                        </span>
                      </div>
                    </label>
                    
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={formData.canOperate}
                        onChange={(e) => setFormData(prev => ({ ...prev, canOperate: e.target.checked }))}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <div className="flex items-center gap-2">
                        <Play className="h-4 w-4 text-green-600" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Operar - Pode iniciar/parar a máquina
                        </span>
                      </div>
                    </label>
                    
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={formData.canEdit}
                        onChange={(e) => setFormData(prev => ({ ...prev, canEdit: e.target.checked }))}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                      <div className="flex items-center gap-2">
                        <Edit className="h-4 w-4 text-purple-600" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          Editar - Pode modificar configurações
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Botões */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        {modalMode === 'create' ? 'Criar' : 'Salvar'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};

export default Permissions;
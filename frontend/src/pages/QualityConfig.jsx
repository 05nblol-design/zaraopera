import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-toastify';
import { FiSettings, FiPlus, FiEdit2, FiTrash2, FiSave, FiX, FiCheck, FiAlertTriangle } from 'react-icons/fi';
import api from '../services/api';

const QualityConfig = () => {
  const { user } = useAuth();
  const [configs, setConfigs] = useState([]);
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null);
  const [formData, setFormData] = useState({
    machineId: '',
    testName: '',
    testDescription: '',
    testFrequency: 50,
    productsPerTest: 1,
    isRequired: true,
    minPassRate: 95.0
  });

  useEffect(() => {
    if (user?.role === 'ADMIN' || user?.role === 'MANAGER') {
      loadConfigs();
      loadMachines();
    }
  }, [user]);

  const loadConfigs = async () => {
    try {
      const response = await api.get('/quality-test-config');
      if (response.data.success) {
        setConfigs(response.data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
      toast.error('Erro ao carregar configurações de qualidade');
    } finally {
      setLoading(false);
    }
  };

  const loadMachines = async () => {
    try {
      const response = await api.get('/machines');
      if (response.data.success) {
        setMachines(response.data.data);
      }
    } catch (error) {
      console.error('Erro ao carregar máquinas:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = editingConfig 
        ? `/quality-test-config/${editingConfig.id}`
        : '/quality-test-config';
      
      const method = editingConfig ? 'put' : 'post';
      
      const response = await api[method](url, {
        ...formData,
        machineId: parseInt(formData.machineId),
        testFrequency: parseInt(formData.testFrequency),
        productsPerTest: parseInt(formData.productsPerTest),
        minPassRate: parseFloat(formData.minPassRate)
      });

      if (response.data.success) {
        toast.success(editingConfig ? 'Configuração atualizada!' : 'Configuração criada!');
        setShowForm(false);
        setEditingConfig(null);
        resetForm();
        loadConfigs();
      }
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      toast.error(error.response?.data?.message || 'Erro ao salvar configuração');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (config) => {
    setEditingConfig(config);
    setFormData({
      machineId: config.machineId.toString(),
      testName: config.testName,
      testDescription: config.testDescription || '',
      testFrequency: config.testFrequency,
      productsPerTest: config.productsPerTest,
      isRequired: config.isRequired,
      minPassRate: config.minPassRate
    });
    setShowForm(true);
  };

  const handleDelete = async (configId) => {
    if (!window.confirm('Tem certeza que deseja excluir esta configuração?')) {
      return;
    }

    try {
      const response = await api.delete(`/quality-test-config/${configId}`);
      if (response.data.success) {
        toast.success('Configuração excluída!');
        loadConfigs();
      }
    } catch (error) {
      console.error('Erro ao excluir configuração:', error);
      toast.error('Erro ao excluir configuração');
    }
  };

  const resetForm = () => {
    setFormData({
      machineId: '',
      testName: '',
      testDescription: '',
      testFrequency: 50,
      productsPerTest: 1,
      isRequired: true,
      minPassRate: 95.0
    });
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingConfig(null);
    resetForm();
  };

  if (user?.role !== 'ADMIN' && user?.role !== 'MANAGER') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <FiAlertTriangle className="mx-auto h-12 w-12 text-red-500" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            Acesso Negado
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Apenas gestores podem acessar as configurações de qualidade.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center">
                <FiSettings className="mr-3" />
                Configurações de Qualidade
              </h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Configure os parâmetros de teste de qualidade para cada máquina
              </p>
            </div>
            <button
              onClick={() => setShowForm(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <FiPlus className="mr-2" />
              Nova Configuração
            </button>
          </div>
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white dark:bg-gray-800">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  {editingConfig ? 'Editar Configuração' : 'Nova Configuração'}
                </h3>
                <button
                  onClick={handleCancel}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <FiX className="h-6 w-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Máquina *
                    </label>
                    <select
                      value={formData.machineId}
                      onChange={(e) => setFormData({ ...formData, machineId: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Selecione uma máquina</option>
                      {machines.map((machine) => (
                        <option key={machine.id} value={machine.id}>
                          {machine.name} ({machine.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Nome do Teste *
                    </label>
                    <input
                      type="text"
                      value={formData.testName}
                      onChange={(e) => setFormData({ ...formData, testName: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Ex: Teste de Qualidade Padrão"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Descrição
                  </label>
                  <textarea
                    value={formData.testDescription}
                    onChange={(e) => setFormData({ ...formData, testDescription: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Descrição do teste de qualidade"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Frequência (peças) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      value={formData.testFrequency}
                      onChange={(e) => setFormData({ ...formData, testFrequency: parseInt(e.target.value) })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Teste a cada X peças produzidas
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Quantidade de Produto por Teste *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      value={formData.productsPerTest}
                      onChange={(e) => setFormData({ ...formData, productsPerTest: parseInt(e.target.value) })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Quantidade de produtos produzidos para gerar alerta e popup de teste necessário
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Taxa Mínima (%) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={formData.minPassRate}
                      onChange={(e) => setFormData({ ...formData, minPassRate: parseFloat(e.target.value) })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isRequired"
                    checked={formData.isRequired}
                    onChange={(e) => setFormData({ ...formData, isRequired: e.target.checked })}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isRequired" className="ml-2 block text-sm text-gray-900 dark:text-white">
                    Teste obrigatório
                  </label>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    <FiSave className="mr-2" />
                    {loading ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Configurations List */}
        <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
              Configurações Ativas
            </h3>
            
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Carregando...</p>
              </div>
            ) : configs.length === 0 ? (
              <div className="text-center py-8">
                <FiSettings className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                  Nenhuma configuração encontrada
                </h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Crie sua primeira configuração de teste de qualidade.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {configs.map((config) => (
                  <div
                    key={config.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                            {config.testName}
                          </h4>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            config.isActive 
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {config.isActive ? 'Ativo' : 'Inativo'}
                          </span>
                          {config.isRequired && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                              Obrigatório
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Máquina: {config.machine?.name} ({config.machine?.code})
                        </p>
                        {config.testDescription && (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {config.testDescription}
                          </p>
                        )}
                        <div className="flex items-center space-x-6 mt-2 text-sm text-gray-500 dark:text-gray-400">
                          <span>Frequência: {config.testFrequency} peças</span>
                          <span className="font-semibold text-blue-600 dark:text-blue-400">
                            Produtos por teste: {config.productsPerTest}
                          </span>
                          <span>Taxa mínima: {config.minPassRate}%</span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEdit(config)}
                          className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                          title="Editar"
                        >
                          <FiEdit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(config.id)}
                          className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                          title="Excluir"
                        >
                          <FiTrash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default QualityConfig;
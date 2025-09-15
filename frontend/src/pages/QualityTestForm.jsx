import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PhotoIcon,
  BeakerIcon,
  EyeIcon,
  XCircleIcon,
  ChartBarIcon,
  DocumentTextIcon,
  ClockIcon,
  ScaleIcon,
  SwatchIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import { machineService } from '../services/api';
import MediaUpload from '../components/ui/MediaUpload';

const QualityTestForm = ({ isModal = false, machineId: propMachineId, onSuccess, onCancel }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [formData, setFormData] = useState({
    machineId: '',
    product: '',
    lot: '',
    boxNumber: '',
    packageSize: '',
    width: '',
    bottomSize: '',
    sideSize: '',
    zipperDistance: '',
    facilitatorDistance: '',
    visualInspection: {
      status: '',
      observations: ''
    },
    dimensionalVerification: {
      status: '',
      observations: ''
    },
    colorConsistency: {
      status: '',
      observations: ''
    },
    surfaceQuality: {
      status: '',
      observations: ''
    },
    adhesionTest: {
      status: '',
      observations: ''
    },
    rulerTest: false,
    hermeticityTest: false,
    attachments: [],
    observations: '',
    approved: null
  });

  useEffect(() => {
    loadMachines();
  }, []);

  useEffect(() => {
    // Usar propMachineId se em modo modal, senão capturar da URL
    const machineIdToUse = isModal ? propMachineId : searchParams.get('machineId');
    console.log('useEffect machineId:', { isModal, propMachineId, machineIdToUse, machinesCount: machines.length });
    if (machineIdToUse && machines.length > 0) {
      console.log('Definindo machineId:', machineIdToUse);
      setFormData(prev => ({
        ...prev,
        machineId: machineIdToUse
      }));
    }
  }, [searchParams, isModal, propMachineId, machines]);

  const loadMachines = async () => {
    try {
      console.log('Carregando máquinas...');
      const response = await machineService.getAll();
      console.log('Resposta do serviço de máquinas:', response);
      console.log('Tipo da resposta:', typeof response);
      console.log('Response.data:', response.data);
      
      // O machineService retorna diretamente a resposta do axios
      if (response.data && response.data.success) {
        console.log('Máquinas carregadas:', response.data.data);
        setMachines(response.data.data);
      } else if (response.data && Array.isArray(response.data)) {
        console.log('Máquinas carregadas (array direto):', response.data);
        setMachines(response.data);
      } else {
        console.log('Formato de resposta inesperado:', response);
      }
    } catch (err) {
      console.error('Erro ao carregar máquinas:', err);
      setError('Erro ao carregar máquinas');
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent],
          [child]: type === 'checkbox' ? checked : value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await api.post('/quality-tests', {
        ...formData,
        operatorId: user.id
      });

      if (response.data.success) {
        setSuccess('Teste de qualidade criado com sucesso!');
        if (isModal && onSuccess) {
          setTimeout(() => {
            onSuccess();
          }, 1500);
        } else {
          setTimeout(() => {
            navigate('/quality-tests');
          }, 2000);
        }
      } else {
        setError(response.data.message || 'Erro ao criar teste');
      }
    } catch (err) {
      console.error('Erro ao criar teste:', err);
      setError(err.response?.data?.message || 'Erro ao criar teste de qualidade');
    } finally {
      setLoading(false);
    }
  };

  const handleApprovalClick = (approved) => {
    setFormData(prev => ({ ...prev, approved }));
  };

  return (
    <>
      {!isModal && (
        <Helmet>
          <title>Novo Teste de Qualidade - Zara Operação</title>
          <meta name="description" content="Criar novo teste de qualidade" />
        </Helmet>
      )}

      <div className={isModal ? "" : "min-h-screen bg-gray-50 dark:bg-gray-900 py-6"}>
        <div className={isModal ? "" : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"}>
          {/* Header */}
          {!isModal && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <button
                onClick={() => navigate('/quality-tests')}
                className="flex items-center text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white mb-6 transition-colors"
              >
                <ArrowLeftIcon className="h-5 w-5 mr-2" />
                Voltar para Testes de Qualidade
              </button>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center space-x-3 mb-2">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                    <BeakerIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                      Novo Teste de Qualidade
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                      Registre um novo teste de qualidade com informações detalhadas
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4"
            >
              <div className="flex items-center">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-3" />
                <p className="text-red-700 dark:text-red-400">{error}</p>
              </div>
            </motion.div>
          )}

          {/* Success Message */}
          {success && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4"
            >
              <div className="flex items-center">
                <CheckCircleIcon className="h-5 w-5 text-green-400 mr-3" />
                <p className="text-green-700 dark:text-green-400">{success}</p>
              </div>
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Card de Informações Básicas */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
            >
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <BeakerIcon className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
                  Informações Básicas
                </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Máquina *
                  </label>
                  <select
                    name="machineId"
                    value={formData.machineId}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors"
                  >
                    <option value="">Selecione uma máquina</option>
                    {machines.map(machine => (
                      <option key={machine.id} value={machine.id}>
                        {machine.name} - {machine.code}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Produto *
                  </label>
                  <input
                    type="text"
                    name="product"
                    value={formData.product}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors"
                    placeholder="Nome do produto"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Lote *
                  </label>
                  <input
                    type="text"
                    name="lot"
                    value={formData.lot}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors"
                    placeholder="Número do lote"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Número da Caixa
                  </label>
                  <input
                    type="text"
                    name="boxNumber"
                    value={formData.boxNumber}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors"
                    placeholder="Número da caixa"
                  />
                </div>
              </div>
              </div>
            </motion.div>

            {/* Card de Parâmetros Técnicos */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
            >
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <ChartBarIcon className="h-5 w-5 mr-2 text-green-600 dark:text-green-400" />
                  Parâmetros Técnicos
                </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tamanho da Embalagem
                  </label>
                  <input
                    type="text"
                    name="packageSize"
                    value={formData.packageSize}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors"
                    placeholder="Ex: 20x30cm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Largura (mm)
                  </label>
                  <input
                    type="number"
                    name="width"
                    value={formData.width}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors"
                    placeholder="Largura em mm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tamanho do Fundo (mm)
                  </label>
                  <input
                    type="number"
                    name="bottomSize"
                    value={formData.bottomSize}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors"
                    placeholder="Tamanho do fundo"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tamanho da Lateral (mm)
                  </label>
                  <input
                    type="number"
                    name="sideSize"
                    value={formData.sideSize}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors resize-none"
                    placeholder="Tamanho da lateral"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Distância do Zíper (mm)
                  </label>
                  <input
                    type="number"
                    name="zipperDistance"
                    value={formData.zipperDistance}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Distância do zíper"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Distância do Facilitador (mm)
                  </label>
                  <input
                    type="number"
                    name="facilitatorDistance"
                    value={formData.facilitatorDistance}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Distância do facilitador"
                  />
                </div>
              </div>
              </div>
            </motion.div>

            {/* Card de Inspeção de Qualidade */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
            >
              {/* Header do Card */}
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-700 dark:to-indigo-700 px-6 py-4">
                <h3 className="text-xl font-bold text-white flex items-center">
                  <EyeIcon className="h-6 w-6 mr-3 text-white" />
                  Inspeção de Qualidade
                </h3>
                <p className="text-purple-100 text-sm mt-1">Avalie cada aspecto da qualidade do produto</p>
              </div>
              
              {/* Conteúdo do Card */}
              <div className="p-6">
              
              {/* Itens de Inspeção */}
              <div className="space-y-6">
                {/* Inspeção Visual */}
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-5 border-l-4 border-blue-500"
                >
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                    <EyeIcon className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
                    Inspeção Visual
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Status da Inspeção
                      </label>
                      <div className="flex flex-wrap gap-3">
                        {['aprovado', 'reprovado', 'pendente'].map((status) => (
                          <motion.button
                            key={status}
                            type="button"
                            onClick={() => handleInputChange({
                              target: { name: 'visualInspection.status', value: status }
                            })}
                            className={`px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200 shadow-sm ${
                              formData.visualInspection.status === status
                                ? status === 'aprovado'
                                  ? 'bg-green-500 text-white shadow-green-200 dark:shadow-green-900/50'
                                  : status === 'reprovado'
                                  ? 'bg-red-500 text-white shadow-red-200 dark:shadow-red-900/50'
                                  : 'bg-yellow-500 text-white shadow-yellow-200 dark:shadow-yellow-900/50'
                                : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500'
                            }`}
                            whileHover={{ scale: 1.05, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            {status === 'aprovado' && <CheckCircleIcon className="h-4 w-4 mr-2 inline" />}
                            {status === 'reprovado' && <XCircleIcon className="h-4 w-4 mr-2 inline" />}
                            {status === 'pendente' && <ClockIcon className="h-4 w-4 mr-2 inline" />}
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Verificação Dimensional */}
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-5 border-l-4 border-green-500"
                >
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                    <ScaleIcon className="h-5 w-5 mr-2 text-green-600 dark:text-green-400" />
                    Verificação Dimensional
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Status da Verificação
                      </label>
                      <div className="flex flex-wrap gap-3">
                        {['aprovado', 'reprovado', 'pendente'].map((status) => (
                          <motion.button
                            key={status}
                            type="button"
                            onClick={() => handleInputChange({
                              target: { name: 'dimensionalVerification.status', value: status }
                            })}
                            className={`px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200 shadow-sm ${
                              formData.dimensionalVerification.status === status
                                ? status === 'aprovado'
                                  ? 'bg-green-500 text-white shadow-green-200 dark:shadow-green-900/50'
                                  : status === 'reprovado'
                                  ? 'bg-red-500 text-white shadow-red-200 dark:shadow-red-900/50'
                                  : 'bg-yellow-500 text-white shadow-yellow-200 dark:shadow-yellow-900/50'
                                : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500'
                            }`}
                            whileHover={{ scale: 1.05, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            {status === 'aprovado' && <CheckCircleIcon className="h-4 w-4 mr-2 inline" />}
                            {status === 'reprovado' && <XCircleIcon className="h-4 w-4 mr-2 inline" />}
                            {status === 'pendente' && <ClockIcon className="h-4 w-4 mr-2 inline" />}
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Consistência de Cor */}
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-5 border-l-4 border-orange-500"
                >
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                    <SwatchIcon className="h-5 w-5 mr-2 text-orange-600 dark:text-orange-400" />
                    Consistência de Cor
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Status da Consistência
                      </label>
                      <div className="flex flex-wrap gap-3">
                        {['aprovado', 'reprovado', 'pendente'].map((status) => (
                          <motion.button
                            key={status}
                            type="button"
                            onClick={() => handleInputChange({
                              target: { name: 'colorConsistency.status', value: status }
                            })}
                            className={`px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200 shadow-sm ${
                              formData.colorConsistency.status === status
                                ? status === 'aprovado'
                                  ? 'bg-green-500 text-white shadow-green-200 dark:shadow-green-900/50'
                                  : status === 'reprovado'
                                  ? 'bg-red-500 text-white shadow-red-200 dark:shadow-red-900/50'
                                  : 'bg-yellow-500 text-white shadow-yellow-200 dark:shadow-yellow-900/50'
                                : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500'
                            }`}
                            whileHover={{ scale: 1.05, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            {status === 'aprovado' && <CheckCircleIcon className="h-4 w-4 mr-2 inline" />}
                            {status === 'reprovado' && <XCircleIcon className="h-4 w-4 mr-2 inline" />}
                            {status === 'pendente' && <ClockIcon className="h-4 w-4 mr-2 inline" />}
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Qualidade da Superfície */}
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                  className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-5 border-l-4 border-teal-500"
                >
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                    <SparklesIcon className="h-5 w-5 mr-2 text-teal-600 dark:text-teal-400" />
                    Qualidade da Superfície
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Status da Superfície
                      </label>
                      <div className="flex flex-wrap gap-3">
                        {['aprovado', 'reprovado', 'pendente'].map((status) => (
                          <motion.button
                            key={status}
                            type="button"
                            onClick={() => handleInputChange({
                              target: { name: 'surfaceQuality.status', value: status }
                            })}
                            className={`px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200 shadow-sm ${
                              formData.surfaceQuality.status === status
                                ? status === 'aprovado'
                                  ? 'bg-green-500 text-white shadow-green-200 dark:shadow-green-900/50'
                                  : status === 'reprovado'
                                  ? 'bg-red-500 text-white shadow-red-200 dark:shadow-red-900/50'
                                  : 'bg-yellow-500 text-white shadow-yellow-200 dark:shadow-yellow-900/50'
                                : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500'
                            }`}
                            whileHover={{ scale: 1.05, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            {status === 'aprovado' && <CheckCircleIcon className="h-4 w-4 mr-2 inline" />}
                            {status === 'reprovado' && <XCircleIcon className="h-4 w-4 mr-2 inline" />}
                            {status === 'pendente' && <ClockIcon className="h-4 w-4 mr-2 inline" />}
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Teste de Aderência */}
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-5 border-l-4 border-purple-500"
                >
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                    <BeakerIcon className="h-5 w-5 mr-2 text-purple-600 dark:text-purple-400" />
                    Teste de Aderência
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                        Status do Teste
                      </label>
                      <div className="flex flex-wrap gap-3">
                        {['aprovado', 'reprovado', 'pendente'].map((status) => (
                          <motion.button
                            key={status}
                            type="button"
                            onClick={() => handleInputChange({
                              target: { name: 'adhesionTest.status', value: status }
                            })}
                            className={`px-6 py-3 rounded-lg text-sm font-semibold transition-all duration-200 shadow-sm ${
                              formData.adhesionTest.status === status
                                ? status === 'aprovado'
                                  ? 'bg-green-500 text-white shadow-green-200 dark:shadow-green-900/50'
                                  : status === 'reprovado'
                                  ? 'bg-red-500 text-white shadow-red-200 dark:shadow-red-900/50'
                                  : 'bg-yellow-500 text-white shadow-yellow-200 dark:shadow-yellow-900/50'
                                : 'bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-500'
                            }`}
                            whileHover={{ scale: 1.05, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            {status === 'aprovado' && <CheckCircleIcon className="h-4 w-4 mr-2 inline" />}
                            {status === 'reprovado' && <XCircleIcon className="h-4 w-4 mr-2 inline" />}
                            {status === 'pendente' && <ClockIcon className="h-4 w-4 mr-2 inline" />}
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
              </div>
            </motion.div>

            {/* Card de Testes Realizados */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
            >
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <CheckCircleIcon className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
                  Testes Realizados
                </h3>
              
              <div className="space-y-4">
                {/* Teste da Régua */}
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="rulerTest"
                    name="rulerTest"
                    checked={formData.rulerTest}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="rulerTest" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Teste da Régua
                  </label>
                  {formData.rulerTest && (
                    <CheckCircleIcon className="h-5 w-5 text-green-500" />
                  )}
                </div>

                {/* Teste de Hermeticidade */}
                <div className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    id="hermeticityTest"
                    name="hermeticityTest"
                    checked={formData.hermeticityTest}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="hermeticityTest" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Teste de Hermeticidade
                  </label>
                  {formData.hermeticityTest && (
                    <CheckCircleIcon className="h-5 w-5 text-green-500" />
                  )}
                </div>
              </div>
              </div>
            </motion.div>

            {/* Card de Mídia */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
            >
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <PhotoIcon className="h-5 w-5 mr-2 text-indigo-600 dark:text-indigo-400" />
                  Anexos
                </h3>
              
              <MediaUpload
                onFilesChange={(files) => setFormData(prev => ({ ...prev, attachments: files }))}
                maxFiles={10}
                acceptedTypes={['image/*', 'video/*', '.pdf']}
              />
              </div>
            </motion.div>

            {/* Card de Observações */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
            >
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <DocumentTextIcon className="h-5 w-5 mr-2 text-gray-600 dark:text-gray-400" />
                  Observações Gerais
                </h3>
              
              <textarea
                name="observations"
                value={formData.observations}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Adicione observações gerais sobre o teste de qualidade..."
              />
              </div>
            </motion.div>

            {/* Cards de Resultado do Teste */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              {/* Card Aprovado */}
              <motion.button
                type="button"
                onClick={() => handleApprovalClick(true)}
                className={`p-6 rounded-lg border-2 transition-all ${
                  formData.approved === true
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-green-400'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center justify-center space-x-3">
                  <CheckCircleIcon className={`h-8 w-8 ${
                    formData.approved === true ? 'text-green-600' : 'text-gray-400'
                  }`} />
                  <span className={`text-lg font-semibold ${
                    formData.approved === true ? 'text-green-700 dark:text-green-400' : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    Aprovado
                  </span>
                </div>
              </motion.button>

              {/* Card Reprovado */}
              <motion.button
                type="button"
                onClick={() => handleApprovalClick(false)}
                className={`p-6 rounded-lg border-2 transition-all ${
                  formData.approved === false
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-red-400'
                }`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center justify-center space-x-3">
                  <XCircleIcon className={`h-8 w-8 ${
                    formData.approved === false ? 'text-red-600' : 'text-gray-400'
                  }`} />
                  <span className={`text-lg font-semibold ${
                    formData.approved === false ? 'text-red-700 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'
                  }`}>
                    Reprovado
                  </span>
                </div>
              </motion.button>
            </motion.div>

            {/* Botões de Ação */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="flex flex-col sm:flex-row gap-4 pt-8"
            >
              <button
                type="button"
                onClick={() => isModal && onCancel ? onCancel() : navigate('/quality-tests')}
                className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
              >
                Cancelar
              </button>
              
              <motion.button
                type="submit"
                disabled={loading || !formData.machineId || !formData.product || !formData.lot}
                className={`flex-1 flex items-center justify-center px-6 py-3 rounded-lg text-white font-medium transition-colors ${
                  loading || !formData.machineId || !formData.product || !formData.lot
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500'
                }`}
                whileHover={!loading ? { scale: 1.02 } : {}}
                whileTap={!loading ? { scale: 0.98 } : {}}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Criando...
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="-ml-1 mr-3 h-5 w-5" />
                    Criar Teste
                  </>
                )}
              </motion.button>
            </motion.div>
          </form>
        </div>
      </div>
    </>
  );
};

export default QualityTestForm;
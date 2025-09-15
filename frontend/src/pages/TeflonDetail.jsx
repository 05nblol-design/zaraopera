import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';

// Hooks
import { useAuth } from '@/hooks/useAuth';

// Ícones
import {
  ArrowLeftIcon,
  CalendarIcon,
  CogIcon,
  UserIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  PencilIcon,
  PhotoIcon,
  MapPinIcon,
  TagIcon,
  DocumentTextIcon,
  XMarkIcon,
  CheckIcon
} from '@heroicons/react/24/outline';

// Serviços
import api from '@/services/api';

// Utilitários
import { cn } from '@/lib/utils';
import { formatDate, formatDateTime } from "@/lib/utils";

const TeflonDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [teflonChange, setTeflonChange] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [selectedImage, setSelectedImage] = useState(null);
  const [saving, setSaving] = useState(false);
  const [qualityTests, setQualityTests] = useState([]);

  // Verificar se usuário pode editar
  const canEdit = user?.role === 'LEADER' || user?.role === 'MANAGER' || user?.role === 'ADMIN';

  // Buscar dados da troca
  useEffect(() => {
    fetchTeflonChange();
    loadQualityTests();
  }, [id]);

  const fetchTeflonChange = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/teflon/${id}`);
      
      if (response.data.success) {
        // Garantir que photos seja sempre um array
        const processedData = {
          ...response.data.data,
          photos: Array.isArray(response.data.data.photos) 
            ? response.data.data.photos 
            : (typeof response.data.data.photos === 'string' 
                ? JSON.parse(response.data.data.photos || '[]') 
                : [])
        };
        

        
        setTeflonChange(processedData);
        setEditForm({
          teflonType: response.data.data.teflonType,
          observations: response.data.data.observations || '',
          expiryDate: response.data.data.expiryDate ? 
            new Date(response.data.data.expiryDate).toISOString().split('T')[0] : ''
        });
      } else {
        setError('Troca de teflon não encontrada');
      }
    } catch (err) {
      console.error('Erro ao buscar troca:', err);
      setError(err.response?.data?.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const loadQualityTests = async () => {
    try {
      const response = await api.get('/quality-tests?limit=8');
      
      if (response.data.success) {
        setQualityTests(response.data.data || []);
      }
    } catch (err) {
      console.error('Erro ao carregar testes de qualidade:', err);
    }
  };

  // Salvar alterações
  const handleSave = async () => {
    try {
      setSaving(true);
      
      const updatePayload = {
        teflonType: editData.teflonType,
        observations: editData.observations
      };
      
      if (editData.expiryDate) {
        updatePayload.expiryDate = new Date(editData.expiryDate).toISOString();
      }
      
      const response = await api.put(`/teflon/${id}`, updatePayload);
      
      if (response.data.success) {
        setTeflonChange(response.data.data);
        setIsEditing(false);
        toast.success('Troca atualizada com sucesso!');
      }
    } catch (err) {
      console.error('Erro ao salvar:', err);
      toast.error(err.response?.data?.message || 'Erro ao salvar alterações');
    } finally {
      setSaving(false);
    }
  };

  // Cancelar edição
  const handleCancel = () => {
    setEditData({
      teflonType: teflonChange.teflonType,
      observations: teflonChange.observations || '',
      expiryDate: teflonChange.expiryDate ? 
        new Date(teflonChange.expiryDate).toISOString().split('T')[0] : ''
    });
    setIsEditing(false);
  };

  // Calcular status
  const getStatus = () => {
    if (!teflonChange?.expiryDate) return { type: 'unknown', label: 'Sem data', color: 'bg-gray-100 text-gray-800' };
    
    const now = new Date();
    const expiryDate = new Date(teflonChange.expiryDate);
    const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry < 0) {
      return { 
        type: 'expired', 
        label: `Vencido há ${Math.abs(daysUntilExpiry)} dias`, 
        color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
        icon: ExclamationTriangleIcon
      };
    } else if (daysUntilExpiry <= 7) {
      return { 
        type: 'expiring', 
        label: `Vence em ${daysUntilExpiry} dias`, 
        color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
        icon: ClockIcon
      };
    } else {
      return { 
        type: 'valid', 
        label: `Válido por ${daysUntilExpiry} dias`, 
        color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
        icon: CheckCircleIcon
      };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Erro</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => navigate('/teflon')}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <ArrowLeftIcon className="h-5 w-5 mr-2" />
            Voltar ao Teflon
          </button>
        </div>
      </div>
    );
  }

  const status = getStatus();
  const StatusIcon = status.icon;

  return (
    <>
      <Helmet>
        <title>Detalhes da Troca de Teflon - Zara Operação</title>
      </Helmet>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <button
              onClick={() => navigate('/teflon')}
              className="flex items-center text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white mb-6 transition-colors"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Voltar para Teflon
            </button>
            
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                      Troca de Teflon #{teflonChange?.id}
                    </h1>
                    <div className={cn(
                      'flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium',
                      status.color
                    )}>
                      {StatusIcon && <StatusIcon className="h-4 w-4" />}
                      <span>{status.label}</span>
                    </div>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400">
                    {teflonChange?.machine?.name} - {teflonChange?.machine?.location}
                  </p>
                </div>
                
                {canEdit && (
                  <div className="mt-4 sm:mt-0 flex space-x-3">
                    {isEditing ? (
                      <>
                        <button
                          onClick={handleCancel}
                          disabled={saving}
                          className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                        >
                          <XMarkIcon className="h-4 w-4 mr-2" />
                          Cancelar
                        </button>
                        <button
                          onClick={handleSave}
                          disabled={saving}
                          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
                        >
                          {saving ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          ) : (
                            <CheckIcon className="h-4 w-4 mr-2" />
                          )}
                          Salvar
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                      >
                        <PencilIcon className="h-4 w-4 mr-2" />
                        Editar
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Informações Principais */}
            <div className="lg:col-span-2 space-y-6">
              {/* Detalhes da Máquina */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
              >
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <CogIcon className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
                  Informações da Máquina
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                      <CogIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Nome</p>
                      <p className="text-gray-900 dark:text-white">{teflonChange?.machine?.name}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                      <MapPinIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Localização</p>
                      <p className="text-gray-900 dark:text-white">{teflonChange?.machine?.location}</p>
                    </div>
                  </div>
                  
                  {teflonChange?.machine?.code && (
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                        <TagIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Código</p>
                        <p className="text-gray-900 dark:text-white">{teflonChange?.machine?.code}</p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Detalhes da Troca */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
              >
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <CalendarIcon className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
                  Detalhes da Troca
                </h2>
                
                <div className="space-y-4">
                  {/* Tipo de Teflon */}
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Tipo de Teflon
                    </label>
                    {isEditing ? (
                      <select
                        value={editData.teflonType}
                        onChange={(e) => setEditData({ ...editData, teflonType: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Teflon Padrão">Teflon Padrão</option>
                        <option value="Teflon Reforçado">Teflon Reforçado</option>
                        <option value="Teflon Premium">Teflon Premium</option>
                        <option value="Teflon Industrial">Teflon Industrial</option>
                      </select>
                    ) : (
                      <p className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-lg">
                        {teflonChange?.teflonType || 'Não especificado'}
                      </p>
                    )}
                  </div>
                  
                  {/* Data de Troca */}
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Data da Troca
                    </label>
                    <p className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-lg">
                      {formatDateTime(teflonChange?.changeDate)}
                    </p>
                  </div>
                  
                  {/* Data de Validade */}
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Data de Validade
                    </label>
                    {isEditing ? (
                      <input
                        type="date"
                        value={editData.expiryDate}
                        onChange={(e) => setEditData({ ...editData, expiryDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    ) : (
                      <p className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-lg">
                        {formatDate(teflonChange?.expiryDate)}
                      </p>
                    )}
                  </div>
                  
                  {/* Observações */}
                  <div>
                    <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
                      Observações
                    </label>
                    {isEditing ? (
                      <textarea
                        value={editData.observations}
                        onChange={(e) => setEditData({ ...editData, observations: e.target.value })}
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        placeholder="Adicione observações sobre a troca..."
                      />
                    ) : (
                      <div className="text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-lg min-h-[100px]">
                        {teflonChange?.observations || (
                          <span className="text-gray-500 dark:text-gray-400 italic">
                            Nenhuma observação registrada
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>

              {/* Fotos */}
              {teflonChange?.photos && Array.isArray(teflonChange.photos) && teflonChange.photos.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-6"
                >
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                      <PhotoIcon className="h-6 w-6 mr-3 text-blue-600 dark:text-blue-400" />
                      Fotos da Troca
                    </h2>
                    <div className="flex items-center gap-3">
                      <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-3 py-1 rounded-full text-sm font-medium">
                        {teflonChange.photos.length} {teflonChange.photos.length === 1 ? 'foto' : 'fotos'}
                      </span>
                      <button
                        onClick={() => {
                          teflonChange.photos.forEach((photo, index) => {
                            const link = document.createElement('a');
                            link.href = `/uploads/images/${photo}`;
                            link.download = `teflon_troca_${teflonChange.id}_foto_${index + 1}.${photo.split('.').pop()}`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          });
                        }}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2"
                        title="Baixar todas as fotos"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-4-4m4 4l4-4m5-5v8a2 2 0 01-2 2H5a2 2 0 01-2-2v-8a2 2 0 012-2h2m10 0V7a2 2 0 00-2-2H9a2 2 0 00-2 2v2m10 0V9a2 2 0 00-2-2H9a2 2 0 00-2 2v2"></path>
                        </svg>
                        Baixar Fotos
                      </button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {teflonChange.photos.map((photo, index) => (
                      <div 
                        key={index} 
                        className="group relative aspect-square bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer"
                        onClick={() => setSelectedImage(photo)}
                      >
                        <img
                          src={`/uploads/images/${photo}`}
                          alt={`Foto ${index + 1} da troca`}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          onError={(e) => {
                            console.error('Erro ao carregar imagem:', photo);
                            e.target.style.display = 'none';
                          }}
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-300 flex items-center justify-center">
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <div className="bg-white dark:bg-gray-800 rounded-full p-2 shadow-lg">
                              <svg className="w-5 h-5 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                              </svg>
                            </div>
                          </div>
                        </div>
                        <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded-md">
                          {index + 1}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
              



            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Informações do Operador */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <UserIcon className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
                  Operador Responsável
                </h3>
                
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Nome</p>
                    <p className="text-gray-900 dark:text-white">{teflonChange?.user?.name}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</p>
                    <p className="text-gray-900 dark:text-white">{teflonChange?.user?.email}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Função</p>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
                      {teflonChange?.user?.role}
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* Histórico */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <ClockIcon className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
                  Histórico
                </h3>
                
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Troca registrada</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDateTime(teflonChange?.createdAt)}
                      </p>
                    </div>
                  </div>
                  
                  {teflonChange?.updatedAt && teflonChange.updatedAt !== teflonChange.createdAt && (
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Última atualização</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDateTime(teflonChange?.updatedAt)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Ações Rápidas */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Ações Rápidas
                </h3>
                
                <div className="space-y-3">
                  <button
                    onClick={() => navigate('/teflon')}
                    className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                  >
                    Ver todas as trocas
                  </button>
                  
                  {canEdit && (
                    <button
                      onClick={() => navigate('/teflon/change')}
                      className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                    >
                      Nova troca
                    </button>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Imagem */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-7xl max-h-[90vh] w-full flex items-center justify-center">
            {/* Botão Fechar */}
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 z-10 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full p-2 transition-all duration-200 hover:scale-110"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
            
            {/* Imagem */}
            <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-2xl overflow-hidden max-w-full max-h-full">
              <img
                src={`/uploads/images/${selectedImage}`}
                alt="Foto ampliada"
                className="max-w-full max-h-[85vh] object-contain block"
                onClick={(e) => e.stopPropagation()}
              />
              
              {/* Informações da imagem */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
                <p className="text-white text-sm font-medium">
                  Foto da Troca de Teflon #{teflonChange?.id}
                </p>
                <p className="text-gray-300 text-xs">
                  Clique fora da imagem ou no X para fechar
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TeflonDetail;
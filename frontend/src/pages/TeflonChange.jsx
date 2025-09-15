import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeftIcon,
  CameraIcon,
  CalendarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  WrenchScrewdriverIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';
import api from '../services/api';
import { useMachinePermissions } from '@/hooks/useMachinePermissions';

const TeflonChange = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [photos, setPhotos] = useState([]);
  
  const [formData, setFormData] = useState({
    machineId: '',
    teflonType: '',
    expiryDate: '',
    observations: ''
  });
  const [uploadedPhotos, setUploadedPhotos] = useState([]);
  const { filterMachinesByPermissions, loading: permissionsLoading } = useMachinePermissions();

  const teflonTypes = [
    { value: 'PTFE', label: 'PTFE - Politetrafluoretileno' },
    { value: 'FEP', label: 'FEP - Fluorinated Ethylene Propylene' },
    { value: 'PFA', label: 'PFA - Perfluoroalkoxy' },
    { value: 'ETFE', label: 'ETFE - Ethylene Tetrafluoroethylene' }
  ];

  useEffect(() => {
    // Aguardar as permissões serem carregadas antes de carregar as máquinas
    if (!permissionsLoading) {
      loadMachines();
    }
  }, [permissionsLoading]);

  useEffect(() => {
    // Calcular data de validade automaticamente (5 dias a partir de hoje)
    if (formData.teflonType) {
      const today = new Date();
      const expiryDate = new Date(today.getTime() + (5 * 24 * 60 * 60 * 1000));
      setFormData(prev => ({
        ...prev,
        expiryDate: expiryDate.toISOString().split('T')[0]
      }));
    }
  }, [formData.teflonType]);

  const loadMachines = async () => {
    try {
      console.log('🔄 TeflonChange: Carregando máquinas...', { permissionsLoading, user: user?.role });
      const response = await api.get('/machines');
      console.log('📡 TeflonChange: Resposta da API:', response.data);
      
      if (response.data && Array.isArray(response.data.data)) {
        const allMachines = response.data.data;
        console.log('📋 TeflonChange: Máquinas recebidas:', allMachines.length);
        console.log('🔍 TeflonChange: Aplicando filtro canOperate...');
        // Aplicar filtro de permissões - operadores só podem trocar teflon em máquinas que podem operar
        const filteredMachines = filterMachinesByPermissions(allMachines, 'canOperate');
        console.log('✅ TeflonChange: Máquinas após filtro canOperate:', filteredMachines.length);
        
        if (filteredMachines.length === 0 && user?.role === 'OPERATOR') {
          console.log('⚠️ TeflonChange: ATENÇÃO - Nenhuma máquina disponível para operador!');
          console.log('   Verifique se o operador tem permissão canOperate=true em alguma máquina.');
        }
        
        setMachines(filteredMachines);
      } else {
        console.log('❌ TeflonChange: Resposta inválida da API');
        setMachines([]);
      }
    } catch (err) {
      console.error('❌ TeflonChange: Erro ao carregar máquinas:', err);
      setError('Erro ao carregar lista de máquinas');
      setMachines([]);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Validar tipo de arquivo
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const invalidFiles = files.filter(file => !validTypes.includes(file.type));
    
    if (invalidFiles.length > 0) {
      setError('Apenas arquivos de imagem (JPEG, PNG, WebP) são permitidos');
      return;
    }

    // Validar tamanho (máximo 5MB por foto)
    const maxSize = 5 * 1024 * 1024; // 5MB
    const oversizedFiles = files.filter(file => file.size > maxSize);
    
    if (oversizedFiles.length > 0) {
      setError('Cada foto deve ter no máximo 5MB');
      return;
    }

    setLoading(true);
    try {
      const formDataUpload = new FormData();
      files.forEach(file => {
        formDataUpload.append('images', file);
      });
      
      const response = await fetch('/api/upload/teflon-images', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formDataUpload
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || 'Erro ao fazer upload das fotos');
      }
      
      const newPhotos = result.data.map(photo => photo.filename);
      setUploadedPhotos(prev => [...prev, ...newPhotos]);
      setPhotos(prev => [...prev, ...files]);
      setError(null);
    } catch (err) {
      setError(err.message || 'Erro ao fazer upload das fotos');
    } finally {
      setLoading(false);
    }
  };

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validações
    if (!formData.machineId) {
      setError('Selecione uma máquina');
      return;
    }
    
    if (!formData.teflonType) {
      setError('Selecione o tipo de teflon');
      return;
    }
    
    if (uploadedPhotos.length === 0) {
      setError('É obrigatório anexar pelo menos uma foto');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        machineId: formData.machineId,
        teflonType: formData.teflonType,
        expiryDate: formData.expiryDate,
        observations: formData.observations || '',
        photos: uploadedPhotos // Enviar os nomes dos arquivos uploadados
      };

      await api.post('/teflon', payload);

      setSuccess(true);
      setTimeout(() => {
        navigate('/teflon');
      }, 2000);
      
    } catch (err) {
      console.error('Erro ao registrar troca:', err);
      setError(err.response?.data?.message || 'Erro ao registrar troca de teflon');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="text-center p-8 bg-white rounded-lg shadow-lg"
        >
          <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Troca Registrada!</h2>
          <p className="text-gray-600">A troca de teflon foi registrada com sucesso.</p>
          <p className="text-sm text-gray-500 mt-2">Redirecionando...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>Nova Troca de Teflon - Zara Operação</title>
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
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Nova Troca de Teflon</h1>
              <p className="text-gray-600 dark:text-gray-400">Registre uma nova troca de teflon com fotos obrigatórias</p>
            </div>
          </motion.div>

          {/* Formulário */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
          >
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Seção: Informações Básicas */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <WrenchScrewdriverIcon className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
                  Informações Básicas
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Seleção de Máquina */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Máquina *
                    </label>
                    <select
                      name="machineId"
                      value={formData.machineId}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors"
                      required
                    >
                      <option value="">Selecione uma máquina</option>
                      {machines.map(machine => (
                        <option key={machine.id} value={machine.id}>
                          {machine.name} - {machine.location}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tipo de Teflon */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tipo de Teflon *
                    </label>
                    <select
                      name="teflonType"
                      value={formData.teflonType}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors"
                      required
                    >
                      <option value="">Selecione o tipo de teflon</option>
                      {teflonTypes.map(type => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Seção: Detalhes da Troca */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <CalendarIcon className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
                  Detalhes da Troca
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Data de Validade (Automática) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Data de Validade (Automática - 5 dias)
                    </label>
                    <div className="relative">
                      <input
                        type="date"
                        name="expiryDate"
                        value={formData.expiryDate}
                        readOnly
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                      />
                      <CalendarIcon className="absolute right-3 top-3.5 h-5 w-5 text-gray-400" />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      A data de validade é calculada automaticamente para 5 dias após a troca
                    </p>
                  </div>

                  {/* Observações */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Observações
                    </label>
                    <textarea
                      name="observations"
                      value={formData.observations}
                      onChange={handleInputChange}
                      rows={4}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors resize-none"
                      placeholder="Adicione observações sobre a troca (opcional)"
                    />
                  </div>
                </div>
              </div>

              {/* Seção: Upload de Fotos */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <CameraIcon className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
                  Fotos * (Obrigatório)
                </h3>
                
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-blue-400 dark:hover:border-blue-500 transition-colors">
                  <CameraIcon className="h-16 w-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                  <div className="space-y-3">
                    <label className="cursor-pointer">
                      <span className="inline-flex items-center px-6 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg font-medium transition-colors">
                        <CameraIcon className="h-5 w-5 mr-2" />
                        Selecionar Fotos
                      </span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Selecione uma ou mais fotos (JPEG, PNG, WebP - máx. 5MB cada)
                    </p>
                  </div>
                </div>

                {/* Preview das fotos */}
                {photos.length > 0 && (
                  <div className="mt-6">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Fotos selecionadas ({photos.length}):
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {photos.map((photo, index) => (
                        <motion.div 
                          key={index} 
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="relative group"
                        >
                          <img
                            src={URL.createObjectURL(photo)}
                            alt={`Foto ${index + 1}`}
                            className="w-full h-28 object-cover rounded-lg border border-gray-200 dark:border-gray-600"
                          />
                          <button
                            type="button"
                            onClick={() => removePhoto(index)}
                            className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold shadow-lg transition-colors opacity-0 group-hover:opacity-100"
                          >
                            ×
                          </button>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 truncate">
                            {photo.name}
                          </p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Mensagens de erro */}
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
                >
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-500 dark:text-red-400 mr-3 flex-shrink-0" />
                  <span className="text-red-700 dark:text-red-300">{error}</span>
                </motion.div>
              )}

              {/* Botões */}
              <div className="flex flex-col sm:flex-row gap-4 pt-8">
                <button
                  type="button"
                  onClick={() => navigate('/teflon')}
                  className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className={cn(
                    "flex-1 px-6 py-3 rounded-lg text-white font-medium transition-colors flex items-center justify-center",
                    loading
                      ? "bg-gray-400 dark:bg-gray-600 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
                  )}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Registrando...
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon className="h-5 w-5 mr-2" />
                      Registrar Troca
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default TeflonChange;
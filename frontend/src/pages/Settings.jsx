import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import {
  UserIcon,
  CogIcon,
  BellIcon,
  ShieldCheckIcon,
  PaintBrushIcon,
  GlobeAltIcon,
  DevicePhoneMobileIcon,
  ComputerDesktopIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  KeyIcon,
  EnvelopeIcon,
  PhoneIcon,
  BuildingOfficeIcon,
  ClockIcon,
  DocumentTextIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ServerIcon,
  WifiIcon,
  SignalIcon,
  SpeakerWaveIcon
} from '@heroicons/react/24/outline';

// Hooks
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useSocket } from '@/hooks/useSocket';
import soundService from '@/services/soundService';

// Components
import SoundSettings from '@/components/settings/SoundSettings';

// Utilitários
import { cn, formatDateTime } from '@/lib/utils';

const Settings = () => {
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showPassword, setShowPassword] = useState(false);
  
  const { user, updateProfile, changePassword } = useAuth();
  const { theme, setTheme, systemTheme } = useTheme();
  const { isConnected } = useSocket();
  
  // Estados dos formulários
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    department: user?.department || '',
    position: user?.position || ''
  });
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    qualityAlerts: true,
    maintenanceAlerts: true,
    productionAlerts: true,
    systemAlerts: true,
    weeklyReports: true,
    monthlyReports: false
  });
  
  const [systemSettings, setSystemSettings] = useState({
    language: 'pt-BR',
    timezone: 'America/Sao_Paulo',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '24h',
    currency: 'BRL',
    autoRefresh: true,
    refreshInterval: 30,
    soundAlerts: true,
    soundVolume: 50,
    compactMode: false
  });
  
  const [securitySettings, setSecuritySettings] = useState({
    twoFactorAuth: false,
    // sessionTimeout removido - sistema sem limite de tempo por usuário
    loginNotifications: true,
    deviceTracking: true,
    ipWhitelist: '',
    // passwordExpiry removido - senhas sem expiração
  });
  
  // Sincronizar configurações de som com o soundService
  useEffect(() => {
    const soundSettings = soundService.getSettings();
    setSystemSettings(prev => ({
      ...prev,
      soundAlerts: soundSettings.enabled,
      soundVolume: Math.round(soundSettings.volume * 100)
    }));
  }, []);

  // Atualizar soundService quando configurações mudarem
  useEffect(() => {
    soundService.setEnabled(systemSettings.soundAlerts);
    soundService.setVolume(systemSettings.soundVolume / 100);
  }, [systemSettings.soundAlerts, systemSettings.soundVolume]);

  // Handlers para configurações de som
  const handleSoundToggle = (enabled) => {
    setSystemSettings(prev => ({ ...prev, soundAlerts: enabled }));
    if (enabled) {
      soundService.playNotification(); // Testar som ao habilitar
    }
  };

  const handleVolumeChange = (volume) => {
    setSystemSettings(prev => ({ ...prev, soundVolume: volume }));
    soundService.playNotification(); // Testar som ao mudar volume
  };

  const testAllSounds = async () => {
    await soundService.testAllSounds();
  };

  // Abas disponíveis baseadas no role do usuário
  const allTabs = [
    {
      id: 'profile',
      name: 'Perfil',
      icon: UserIcon,
      description: 'Informações pessoais e profissionais',
      roles: ['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN']
    },
    {
      id: 'notifications',
      name: 'Notificações',
      icon: BellIcon,
      description: 'Preferências de alertas e notificações',
      roles: ['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN']
    },
    {
      id: 'sounds',
      name: 'Sons',
      icon: SpeakerWaveIcon,
      description: 'Configurações de sons e alertas sonoros',
      roles: ['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN']
    },
    {
      id: 'appearance',
      name: 'Aparência',
      icon: PaintBrushIcon,
      description: 'Tema, idioma e personalização',
      roles: ['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN']
    },
    {
      id: 'security',
      name: 'Segurança',
      icon: ShieldCheckIcon,
      description: 'Senha, autenticação e privacidade',
      roles: ['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN']
    },
    {
      id: 'system',
      name: 'Sistema',
      icon: CogIcon,
      description: 'Configurações gerais do sistema',
      roles: ['ADMIN'] // Apenas administradores
    }
  ];

  // Filtrar abas baseadas no role do usuário
  const tabs = allTabs.filter(tab => tab.roles.includes(user?.role));
  
  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 5000);
  };
  
  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await updateProfile(profileData);
      showMessage('success', 'Perfil atualizado com sucesso!');
    } catch (error) {
      showMessage('error', 'Erro ao atualizar perfil: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showMessage('error', 'As senhas não coincidem!');
      return;
    }
    
    if (passwordData.newPassword.length < 8) {
      showMessage('error', 'A nova senha deve ter pelo menos 8 caracteres!');
      return;
    }
    
    setLoading(true);
    
    try {
      await changePassword(passwordData.currentPassword, passwordData.newPassword);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showMessage('success', 'Senha alterada com sucesso!');
    } catch (error) {
      showMessage('error', 'Erro ao alterar senha: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleNotificationUpdate = async () => {
    setLoading(true);
    
    try {
      // Simular API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      showMessage('success', 'Configurações de notificação atualizadas!');
    } catch (error) {
      showMessage('error', 'Erro ao atualizar configurações!');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSystemUpdate = async () => {
    setLoading(true);
    
    try {
      // Simular API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      showMessage('success', 'Configurações do sistema atualizadas!');
    } catch (error) {
      showMessage('error', 'Erro ao atualizar configurações!');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSecurityUpdate = async () => {
    setLoading(true);
    
    try {
      // Simular API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      showMessage('success', 'Configurações de segurança atualizadas!');
    } catch (error) {
      showMessage('error', 'Erro ao atualizar configurações!');
    } finally {
      setLoading(false);
    }
  };
  
  const ProfileTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Informações Pessoais
        </h3>
        
        <form onSubmit={handleProfileUpdate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nome Completo
              </label>
              <input
                type="text"
                value={profileData.name}
                onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={profileData.email}
                onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Telefone
              </label>
              <input
                type="tel"
                value={profileData.phone}
                onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Departamento
              </label>
              <select
                value={profileData.department}
                onChange={(e) => setProfileData({ ...profileData, department: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Selecione...</option>
                <option value="PRODUCTION">Produção</option>
                <option value="QUALITY">Qualidade</option>
                <option value="MAINTENANCE">Manutenção</option>
                <option value="MANAGEMENT">Gestão</option>
                <option value="IT">TI</option>
              </select>
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Cargo
              </label>
              <input
                type="text"
                value={profileData.position}
                onChange={(e) => setProfileData({ ...profileData, position: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
      
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Alterar Senha
        </h3>
        
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Senha Atual
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
              >
                {showPassword ? (
                  <EyeSlashIcon className="h-4 w-4 text-gray-400" />
                ) : (
                  <EyeIcon className="h-4 w-4 text-gray-400" />
                )}
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Nova Senha
              </label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                minLength={8}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Confirmar Nova Senha
              </label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
                minLength={8}
              />
            </div>
          </div>
          
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Alterando...' : 'Alterar Senha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
  
  const NotificationsTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Preferências de Notificação
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center space-x-3">
              <EnvelopeIcon className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Notificações por Email
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Receber alertas e relatórios por email
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notificationSettings.emailNotifications}
                onChange={(e) => setNotificationSettings({
                  ...notificationSettings,
                  emailNotifications: e.target.checked
                })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center space-x-3">
              <DevicePhoneMobileIcon className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Notificações Push
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Receber notificações no navegador
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={notificationSettings.pushNotifications}
                onChange={(e) => setNotificationSettings({
                  ...notificationSettings,
                  pushNotifications: e.target.checked
                })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>
      
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Tipos de Alertas
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { key: 'qualityAlerts', label: 'Alertas de Qualidade', desc: 'Testes reprovados e defeitos' },
            { key: 'maintenanceAlerts', label: 'Alertas de Manutenção', desc: 'Manutenções programadas e emergenciais' },
            { key: 'productionAlerts', label: 'Alertas de Produção', desc: 'Metas e eficiência de produção' },
            { key: 'systemAlerts', label: 'Alertas do Sistema', desc: 'Atualizações e problemas técnicos' }
          ].map((alert) => (
            <div key={alert.key} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {alert.label}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {alert.desc}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notificationSettings[alert.key]}
                  onChange={(e) => setNotificationSettings({
                    ...notificationSettings,
                    [alert.key]: e.target.checked
                  })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>
          ))}
        </div>
      </div>
      
      <div className="flex justify-end">
        <button
          onClick={handleNotificationUpdate}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </div>
    </div>
  );
  
  const AppearanceTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Tema
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { value: 'light', label: 'Claro', icon: ComputerDesktopIcon },
            { value: 'dark', label: 'Escuro', icon: DevicePhoneMobileIcon },
            { value: 'system', label: 'Sistema', icon: CogIcon }
          ].map((themeOption) => {
            const Icon = themeOption.icon;
            const isSelected = theme === themeOption.value;
            
            return (
              <button
                key={themeOption.value}
                onClick={() => setTheme(themeOption.value)}
                className={cn(
                  'p-4 border-2 rounded-lg text-left transition-all duration-200',
                  isSelected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                )}
              >
                <div className="flex items-center space-x-3">
                  <div className={cn(
                    'p-2 rounded-lg',
                    isSelected
                      ? 'bg-blue-100 dark:bg-blue-900/40'
                      : 'bg-gray-100 dark:bg-gray-700'
                  )}>
                    <Icon className={cn(
                      'h-6 w-6',
                      isSelected
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-600 dark:text-gray-400'
                    )} />
                  </div>
                  <div>
                    <p className={cn(
                      'font-medium',
                      isSelected
                        ? 'text-blue-900 dark:text-blue-100'
                        : 'text-gray-900 dark:text-white'
                    )}>
                      {themeOption.label}
                    </p>
                    {themeOption.value === 'system' && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Detectado: {systemTheme}
                      </p>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Idioma e Região
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Idioma
            </label>
            <select
              value={systemSettings.language}
              onChange={(e) => setSystemSettings({ ...systemSettings, language: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="pt-BR">Português (Brasil)</option>
              <option value="en-US">English (US)</option>
              <option value="es-ES">Español</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Fuso Horário
            </label>
            <select
              value={systemSettings.timezone}
              onChange={(e) => setSystemSettings({ ...systemSettings, timezone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="America/Sao_Paulo">São Paulo (GMT-3)</option>
              <option value="America/New_York">New York (GMT-5)</option>
              <option value="Europe/London">London (GMT+0)</option>
            </select>
          </div>
        </div>
      </div>
      
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Formato
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Formato de Data
            </label>
            <select
              value={systemSettings.dateFormat}
              onChange={(e) => setSystemSettings({ ...systemSettings, dateFormat: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="DD/MM/YYYY">DD/MM/AAAA</option>
              <option value="MM/DD/YYYY">MM/DD/AAAA</option>
              <option value="YYYY-MM-DD">AAAA-MM-DD</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Formato de Hora
            </label>
            <select
              value={systemSettings.timeFormat}
              onChange={(e) => setSystemSettings({ ...systemSettings, timeFormat: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="24h">24 horas</option>
              <option value="12h">12 horas (AM/PM)</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Moeda
            </label>
            <select
              value={systemSettings.currency}
              onChange={(e) => setSystemSettings({ ...systemSettings, currency: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="BRL">Real (R$)</option>
              <option value="USD">Dólar ($)</option>
              <option value="EUR">Euro (€)</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
  
  const SecurityTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Autenticação
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center space-x-3">
              <ShieldCheckIcon className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Autenticação de Dois Fatores
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Adicionar uma camada extra de segurança
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={securitySettings.twoFactorAuth}
                onChange={(e) => setSecuritySettings({
                  ...securitySettings,
                  twoFactorAuth: e.target.checked
                })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <InformationCircleIcon className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Sistema sem Limites de Tempo
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  Este sistema foi configurado para não ter limites de tempo por usuário. 
                  As sessões e senhas não expiram automaticamente.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Monitoramento
        </h3>
        
        <div className="space-y-4">
          {[
            { key: 'loginNotifications', label: 'Notificações de Login', desc: 'Alertar sobre novos logins' },
            { key: 'deviceTracking', label: 'Rastreamento de Dispositivos', desc: 'Monitorar dispositivos utilizados' }
          ].map((setting) => (
            <div key={setting.key} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {setting.label}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {setting.desc}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={securitySettings[setting.key]}
                  onChange={(e) => setSecuritySettings({
                    ...securitySettings,
                    [setting.key]: e.target.checked
                  })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>
          ))}
        </div>
      </div>
      
      <div className="flex justify-end">
        <button
          onClick={handleSecurityUpdate}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </div>
    </div>
  );
  
  const SystemTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Atualização Automática
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center space-x-3">
              <ServerIcon className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Atualização Automática
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Atualizar dados automaticamente
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={systemSettings.autoRefresh}
                onChange={(e) => setSystemSettings({
                  ...systemSettings,
                  autoRefresh: e.target.checked
                })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
          
          {systemSettings.autoRefresh && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Intervalo de Atualização (segundos)
              </label>
              <input
                type="number"
                value={systemSettings.refreshInterval}
                onChange={(e) => setSystemSettings({
                  ...systemSettings,
                  refreshInterval: parseInt(e.target.value)
                })}
                min={10}
                max={300}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          )}
        </div>
      </div>
      
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Interface
        </h3>
        
        <div className="space-y-4">
          {/* Alertas Sonoros */}
          <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Alertas Sonoros
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Reproduzir sons para alertas importantes
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={systemSettings.soundAlerts}
                  onChange={(e) => handleSoundToggle(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>
            
            {/* Controle de Volume */}
            {systemSettings.soundAlerts && (
              <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-gray-700 dark:text-gray-300">
                    Volume: {systemSettings.soundVolume}%
                  </label>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={testAllSounds}
                      className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                    >
                      Testar Sons
                    </button>
                  </div>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={systemSettings.soundVolume}
                  onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 slider"
                />
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                  <span>Silencioso</span>
                  <span>Alto</span>
                </div>
              </div>
            )}
          </div>
          
          {/* Modo Compacto */}
          <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Modo Compacto
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Interface mais densa com menos espaçamento
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={systemSettings.compactMode}
                onChange={(e) => setSystemSettings({
                  ...systemSettings,
                  compactMode: e.target.checked
                })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>
      
      <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Informações do Sistema
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <WifiIcon className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Status da Conexão
              </span>
            </div>
            <div className={cn(
              'flex items-center space-x-2',
              isConnected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            )}>
              <div className={cn(
                'h-2 w-2 rounded-full',
                isConnected ? 'bg-green-500' : 'bg-red-500'
              )} />
              <span className="text-sm">
                {isConnected ? 'Conectado' : 'Desconectado'}
              </span>
            </div>
          </div>
          
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <DocumentTextIcon className="h-4 w-4 text-gray-400" />
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Versão do Sistema
              </span>
            </div>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              v1.0.1 (Build 2024.01.15)
            </span>
          </div>
        </div>
      </div>
      
      <div className="flex justify-end">
        <button
          onClick={handleSystemUpdate}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </div>
    </div>
  );
  
  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfileTab />;
      case 'notifications':
        return <NotificationsTab />;
      case 'sounds':
        return <SoundSettings />;
      case 'appearance':
        return <AppearanceTab />;
      case 'security':
        return <SecurityTab />;
      case 'system':
        return <SystemTab />;
      default:
        return <ProfileTab />;
    }
  };
  
  return (
    <>
      <Helmet>
        <title>{user?.role === 'ADMIN' ? 'Configurações do Sistema - ZARA' : 'Configurações Pessoais - ZARA'}</title>
        <meta name="description" content={user?.role === 'ADMIN' ? 'Configurações do Sistema ZARA' : 'Configurações Pessoais do Sistema ZARA'} />
      </Helmet>
      
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {user?.role === 'ADMIN' ? 'Configurações do Sistema' : 'Configurações Pessoais'}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {user?.role === 'ADMIN' 
                ? 'Gerencie as configurações do sistema e preferências pessoais'
                : 'Gerencie suas preferências pessoais'
              }
            </p>
          </div>
          
          {/* Status de conexão */}
          <div className={cn(
            'mt-4 sm:mt-0 flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium',
            isConnected 
              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
              : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
          )}>
            <div className={cn(
              'h-1.5 w-1.5 rounded-full',
              isConnected ? 'bg-green-500' : 'bg-red-500'
            )} />
            <span>{isConnected ? 'Online' : 'Offline'}</span>
          </div>
        </div>
        
        {/* Mensagem de feedback */}
        <AnimatePresence>
          {message.text && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={cn(
                'p-4 rounded-lg flex items-center space-x-3',
                message.type === 'success' 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
              )}
            >
              {message.type === 'success' ? (
                <CheckIcon className="h-5 w-5" />
              ) : (
                <ExclamationTriangleIcon className="h-5 w-5" />
              )}
              <span className="text-sm font-medium">{message.text}</span>
              <button
                onClick={() => setMessage({ type: '', text: '' })}
                className="ml-auto"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Navegação das abas */}
          <div className="lg:col-span-1">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                      isActive
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700/50'
                    )}
                  >
                    <Icon className={cn(
                      'mr-3 h-5 w-5',
                      isActive ? 'text-blue-500 dark:text-blue-400' : 'text-gray-400'
                    )} />
                    <div className="text-left">
                      <div>{tab.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 font-normal">
                        {tab.description}
                      </div>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>
          
          {/* Conteúdo da aba */}
          <div className="lg:col-span-3">
            <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="p-6">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                  >
                    {renderTabContent()}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Settings;
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Helmet } from 'react-helmet-async';
import {
  UserIcon,
  BellIcon,
  PaintBrushIcon,
  ShieldCheckIcon,
  CheckIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  SpeakerWaveIcon
} from '@heroicons/react/24/outline';

// Hooks
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { useSocket } from '@/hooks/useSocket';

// Components
import SoundSettings from '@/components/settings/SoundSettings';

// Utilitários
import { cn } from '@/lib/utils';

const PersonalSettings = () => {
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
  
  const [securitySettings, setSecuritySettings] = useState({
    twoFactorAuth: false,
    sessionTimeout: 30,
    loginNotifications: true
  });

  // Tabs apenas para configurações pessoais
  const tabs = [
    {
      id: 'profile',
      name: 'Perfil',
      icon: UserIcon,
      roles: ['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN']
    },
    {
      id: 'notifications',
      name: 'Notificações',
      icon: BellIcon,
      roles: ['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN']
    },
    {
      id: 'sounds',
      name: 'Sons',
      icon: SpeakerWaveIcon,
      roles: ['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN']
    },
    {
      id: 'appearance',
      name: 'Aparência',
      icon: PaintBrushIcon,
      roles: ['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN']
    },
    {
      id: 'security',
      name: 'Segurança',
      icon: ShieldCheckIcon,
      roles: ['OPERATOR', 'LEADER', 'MANAGER', 'ADMIN']
    }
  ];

  // Filtrar tabs baseado no papel do usuário
  const filteredTabs = tabs.filter(tab => 
    tab.roles.includes(user?.role)
  );

  // Funções de manipulação
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
      showMessage('error', 'As senhas não coincidem');
      return;
    }
    
    if (passwordData.newPassword.length < 6) {
      showMessage('error', 'A nova senha deve ter pelo menos 6 caracteres');
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

  const handleNotificationUpdate = () => {
    // Implementar salvamento das configurações de notificação
    showMessage('success', 'Configurações de notificação salvas!');
  };

  const handleSecurityUpdate = () => {
    // Implementar salvamento das configurações de segurança
    showMessage('success', 'Configurações de segurança salvas!');
  };

  // Componentes das abas
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
            <input
              type="password"
              value={passwordData.currentPassword}
              onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          
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
            />
          </div>
          
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Alterando...' : 'Alterar Senha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  const NotificationsTab = () => {
    const notificationTypes = [
      { key: 'emailNotifications', label: 'Notificações por Email', desc: 'Receber notificações por email' },
      { key: 'pushNotifications', label: 'Notificações Push', desc: 'Receber notificações no navegador' },
      { key: 'qualityAlerts', label: 'Alertas de Qualidade', desc: 'Notificações sobre testes de qualidade' },
      { key: 'maintenanceAlerts', label: 'Alertas de Manutenção', desc: 'Notificações sobre manutenção de máquinas' },
      { key: 'productionAlerts', label: 'Alertas de Produção', desc: 'Notificações sobre produção' },
      { key: 'systemAlerts', label: 'Alertas do Sistema', desc: 'Notificações sobre o sistema' },
      { key: 'weeklyReports', label: 'Relatórios Semanais', desc: 'Receber relatórios semanais por email' },
      { key: 'monthlyReports', label: 'Relatórios Mensais', desc: 'Receber relatórios mensais por email' }
    ];

    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Preferências de Notificação
          </h3>
          
          <div className="space-y-4">
            {notificationTypes.map((alert) => (
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
  };

  const AppearanceTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Tema
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { value: 'light', label: 'Claro' },
            { value: 'dark', label: 'Escuro' },
            { value: 'system', label: 'Sistema' }
          ].map((themeOption) => {
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
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  const SecurityTab = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Configurações de Segurança
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Autenticação de Dois Fatores
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Adicione uma camada extra de segurança à sua conta
              </p>
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
          
          <div className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-600 rounded-lg">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Notificações de Login
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Receber notificações quando alguém fizer login na sua conta
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={securitySettings.loginNotifications}
                onChange={(e) => setSecuritySettings({
                  ...securitySettings,
                  loginNotifications: e.target.checked
                })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
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
      default:
        return <ProfileTab />;
    }
  };

  return (
    <>
      <Helmet>
        <title>Configurações Pessoais - ZARA</title>
        <meta name="description" content="Configurações Pessoais do Sistema ZARA" />
      </Helmet>
      
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Configurações Pessoais
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Gerencie suas preferências pessoais
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
              {filteredTabs.map((tab) => {
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
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-700'
                    )}
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    {tab.name}
                  </button>
                );
              })}
            </nav>
          </div>
          
          {/* Conteúdo da aba */}
          <div className="lg:col-span-3">
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
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
    </>
  );
};

export default PersonalSettings;
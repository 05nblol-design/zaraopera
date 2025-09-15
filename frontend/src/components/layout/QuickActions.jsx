import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  StarIcon,
  ArrowRightIcon,
  CogIcon,
  DocumentTextIcon,
  ChartBarIcon,
  UserGroupIcon,
  WrenchScrewdriverIcon,
  BeakerIcon,
  BellIcon
} from '@heroicons/react/24/outline';

// Hooks
import { useAuth } from '@/hooks/useAuth';
import { useSocket } from '@/hooks/useSocket';

// Utilitários
import { cn } from '@/lib/utils';
import { ROUTES } from '@/config/routes';

// Popups
import DataAnalysisPopup from '@/components/popups/DataAnalysisPopup';
import ReportsPopup from '@/components/popups/ReportsPopup';

const QuickActions = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentActions, setRecentActions] = useState([]);
  const [showDataAnalysisPopup, setShowDataAnalysisPopup] = useState(false);
  const [showReportsPopup, setShowReportsPopup] = useState(false);
  
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { machineStatuses } = useSocket();

  // Focar no input quando abrir
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Carregar ações recentes do localStorage
  useEffect(() => {
    const saved = localStorage.getItem('quickActions_recent');
    if (saved) {
      try {
        setRecentActions(JSON.parse(saved));
      } catch (error) {
        console.error('Erro ao carregar ações recentes:', error);
      }
    }
  }, []);

  // Salvar ação recente
  const saveRecentAction = (action) => {
    const updated = [
      action,
      ...recentActions.filter(a => a.id !== action.id)
    ].slice(0, 5); // Manter apenas 5 recentes
    
    setRecentActions(updated);
    localStorage.setItem('quickActions_recent', JSON.stringify(updated));
  };

  // Ações disponíveis baseadas no papel do usuário
  const getAvailableActions = () => {
    const baseActions = [
      {
        id: 'dashboard',
        title: 'Dashboard',
        description: 'Visão geral do sistema',
        icon: ChartBarIcon,
        path: ROUTES.DASHBOARD,
        keywords: ['dashboard', 'inicio', 'home', 'visao geral'],
        hasPopup: true,
        popupAction: () => setShowDataAnalysisPopup(true)
      },
      {
        id: 'quality-test',
        title: 'Novo Teste de Qualidade',
        description: 'Registrar teste de qualidade',
        icon: BeakerIcon,
        path: ROUTES.QUALITY_NEW,
        keywords: ['teste', 'qualidade', 'novo', 'registrar']
      },
      {
        id: 'machines',
        title: 'Máquinas',
        description: 'Gerenciar máquinas',
        icon: WrenchScrewdriverIcon,
        path: ROUTES.MACHINES,
        keywords: ['maquinas', 'equipamentos', 'status']
      },
      {
        id: 'reports',
        title: 'Relatórios',
        description: 'Visualizar relatórios',
        icon: DocumentTextIcon,
        path: ROUTES.REPORTS,
        keywords: ['relatorios', 'dados', 'estatisticas'],
        hasPopup: true,
        popupAction: () => setShowReportsPopup(true)
      }
    ];

    // Ações específicas por papel
    if (user?.role === 'ADMIN' || user?.role === 'MANAGER') {
      baseActions.push(
        {
          id: 'users',
          title: 'Usuários',
          description: 'Gerenciar usuários',
          icon: UserGroupIcon,
          path: ROUTES.USERS,
          keywords: ['usuarios', 'equipe', 'funcionarios']
        },
        {
          id: 'settings',
          title: 'Configurações',
          description: 'Configurações do sistema',
          icon: CogIcon,
          path: ROUTES.SETTINGS?.path || '/settings',
          keywords: ['configuracoes', 'ajustes', 'sistema']
        }
      );
    }

    return baseActions;
  };

  // Filtrar ações baseado na busca
  const filteredActions = getAvailableActions().filter(action => {
    if (!query.trim()) return true;
    
    const searchTerm = query.toLowerCase();
    return (
      action.title.toLowerCase().includes(searchTerm) ||
      action.description.toLowerCase().includes(searchTerm) ||
      action.keywords.some(keyword => keyword.includes(searchTerm))
    );
  });

  // Ações rápidas do sistema
  const systemActions = [
    {
      id: 'notifications',
      title: 'Ver Notificações',
      description: 'Abrir painel de notificações',
      icon: BellIcon,
      action: () => {
        onClose();
        // Trigger notification panel
        document.dispatchEvent(new CustomEvent('openNotifications'));
      }
    }
  ];

  // Todas as ações (navegação + sistema)
  const allActions = [...filteredActions, ...systemActions];

  // Navegação por teclado
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev < allActions.length - 1 ? prev + 1 : 0
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => 
            prev > 0 ? prev - 1 : allActions.length - 1
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (allActions[selectedIndex]) {
            handleActionSelect(allActions[selectedIndex]);
          }
          break;
        case 'Escape':
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, allActions]);

  // Reset do índice selecionado quando a busca muda
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleActionSelect = (action) => {
    if (action.hasPopup && action.popupAction) {
      action.popupAction();
      saveRecentAction(action);
      onClose();
    } else if (action.path) {
      navigate(action.path);
      saveRecentAction(action);
      onClose();
    } else if (action.action) {
      action.action();
      saveRecentAction(action);
    }
  };

  // Status das máquinas para exibição rápida
  const machineStatusSummary = {
    running: machineStatuses ? Object.values(machineStatuses).filter(s => s === 'FUNCIONANDO').length : 0,
    stopped: machineStatuses ? Object.values(machineStatuses).filter(s => s === 'STOPPED').length : 0,
    maintenance: machineStatuses ? Object.values(machineStatuses).filter(s => s === 'MAINTENANCE').length : 0,
    error: machineStatuses ? Object.values(machineStatuses).filter(s => s === 'ERROR').length : 0
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 bg-black bg-opacity-25 z-50"
            />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-16">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ duration: 0.15 }}
              className="w-full max-w-2xl mx-4 bg-white dark:bg-gray-800 rounded-lg shadow-xl"
            >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-2">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Ações Rápidas
                </h2>
              </div>
              
              <button
                onClick={onClose}
                className="p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Search */}
            <div className="p-4">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar ações, páginas, configurações..."
                  className="w-full pl-10 pr-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                />
              </div>
            </div>

            {/* Quick Stats */}
            <div className="px-4 pb-4">
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                  <div className="text-sm text-green-600 dark:text-green-400">Funcionando</div>
                  <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                    {machineStatusSummary.running}
                  </div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                  <div className="text-sm text-red-600 dark:text-red-400">Paradas</div>
                  <div className="text-2xl font-bold text-red-700 dark:text-red-300">
                    {machineStatusSummary.stopped}
                  </div>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                  <div className="text-sm text-yellow-600 dark:text-yellow-400">Manutenção</div>
                  <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
                    {machineStatusSummary.maintenance}
                  </div>
                </div>
                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                  <div className="text-sm text-red-600 dark:text-red-400">Erro</div>
                  <div className="text-2xl font-bold text-red-700 dark:text-red-300">
                    {machineStatusSummary.error}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions List */}
            <div className="max-h-96 overflow-y-auto">
              {/* Recent Actions */}
              {!query && recentActions.length > 0 && (
                <div className="px-4 pb-2">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center">
                    <ClockIcon className="h-4 w-4 mr-1" />
                    Recentes
                  </h3>
                  <div className="space-y-1">
                    {recentActions.slice(0, 3).map((action, index) => {
                      const Icon = action.icon;
                      return (
                        <button
                          key={`recent-${action.id}`}
                          onClick={() => handleActionSelect(action)}
                          className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
                        >
                          <Icon className="h-5 w-5 text-gray-400" />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {action.title}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {action.description}
                            </div>
                          </div>
                          <StarIcon className="h-4 w-4 text-yellow-400" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* All Actions */}
              <div className="px-4 pb-4">
                {!query && recentActions.length > 0 && (
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                    Todas as Ações
                  </h3>
                )}
                
                {allActions.length === 0 ? (
                  <div className="text-center py-8">
                    <MagnifyingGlassIcon className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">
                      Nenhuma ação encontrada para "{query}"
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {allActions.filter(action => {
                      // Verificar se o ícone é válido
                      if (!action.icon) {
                        console.warn('Action without icon:', action.id, action.title);
                        return false;
                      }
                      
                      // Verificar se é um componente React válido
                      const isValidIcon = typeof action.icon === 'function' || 
                        (typeof action.icon === 'object' && action.icon !== null && 
                         (action.icon.$$typeof === Symbol.for('react.element') || 
                          action.icon.$$typeof === Symbol.for('react.forward_ref') ||
                          action.icon.$$typeof === Symbol.for('react.memo')));
                      
                      if (!isValidIcon) {
                        console.warn('Invalid icon type for action:', action.id, typeof action.icon, action.icon);
                        return false;
                      }
                      
                      return true;
                    }).map((action, index) => {
                      const Icon = action.icon;
                      const isSelected = index === selectedIndex;
                      
                      return (
                        <button
                          key={action.id}
                          onClick={() => handleActionSelect(action)}
                          className={cn(
                            'w-full flex items-center space-x-3 p-3 rounded-lg transition-colors text-left',
                            isSelected
                              ? 'bg-blue-100 dark:bg-blue-900/20'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                          )}
                        >
                          <Icon className={cn(
                            'h-5 w-5',
                            isSelected 
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-gray-400'
                          )} />
                          <div className="flex-1">
                            <div className={cn(
                              'text-sm font-medium',
                              isSelected
                                ? 'text-blue-900 dark:text-blue-100'
                                : 'text-gray-900 dark:text-white'
                            )}>
                              {action.title}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {action.description}
                            </div>
                          </div>
                          <ArrowRightIcon className={cn(
                            'h-4 w-4',
                            isSelected 
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-gray-300'
                          )} />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <span>↑↓ para navegar</span>
                  <span>Enter para selecionar</span>
                  <span>Esc para fechar</span>
                </div>
                <div>
                  Ctrl+K para abrir
                </div>
              </div>
            </div>
            </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    
    {/* Popups */}
    <DataAnalysisPopup 
      isOpen={showDataAnalysisPopup} 
      onClose={() => setShowDataAnalysisPopup(false)} 
    />
    
    <ReportsPopup 
      isOpen={showReportsPopup} 
      onClose={() => setShowReportsPopup(false)} 
    />
  </>
  );
};

export default QuickActions;
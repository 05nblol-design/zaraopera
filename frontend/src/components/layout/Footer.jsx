import React from 'react';


const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border-t border-gray-200/50 dark:border-gray-700/50 mt-8 flex-shrink-0 shadow-lg">
      <div className="px-6 sm:px-8 lg:px-12 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <span>© {currentYear} Zara Operação</span>
            <span>•</span>
            <span>Sistema de Controle de Qualidade</span>
          </div>
          
          <div className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400">
            <span className="flex items-center space-x-2">
              <span>Desenvolvido por</span>
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                SALVIANO TECH
              </span>
            </span>
          </div>
        </div>
        
        <div className="mt-6 pt-6 border-t border-gray-200/50 dark:border-gray-700/50">
          <div className="flex flex-wrap justify-center md:justify-start gap-x-6 gap-y-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="font-medium">Versão 1.0.1</span>
            <span className="hidden sm:inline">•</span>
            <span>Última atualização: {new Date().toLocaleDateString('pt-BR')}</span>
            <span className="hidden sm:inline">•</span>
            <span className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors cursor-pointer">Suporte: suporte@zara.com</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const cron = require('node-cron');
const { promisify } = require('util');
const execAsync = promisify(exec);
const auditLogger = require('./auditLogger');

class BackupService {
  constructor() {
    this.backupDir = process.env.BACKUP_DIR || path.join(__dirname, '../backups');
    this.maxBackups = parseInt(process.env.MAX_BACKUPS) || 7; // Manter 7 backups por padrão
    this.backupSchedule = process.env.BACKUP_SCHEDULE || '0 2 * * *'; // Todo dia às 2h da manhã
    this.isRunning = false;
    
    // Configurações do banco
    this.dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'zara_operacao',
      username: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD
    };
    
    this.initializeBackupDirectory();
  }

  // Inicializar diretório de backup
  async initializeBackupDirectory() {
    try {
      await fs.access(this.backupDir);
    } catch (error) {
      // Diretório não existe, criar
      await fs.mkdir(this.backupDir, { recursive: true });
      console.log(`📁 Diretório de backup criado: ${this.backupDir}`);
    }
  }

  // Iniciar serviço de backup automático
  start() {
    if (this.isRunning) {
      console.log('⚠️ Serviço de backup já está em execução');
      return;
    }

    // Agendar backup automático
    cron.schedule(this.backupSchedule, async () => {
      console.log('🔄 Iniciando backup automático...');
      await this.createBackup();
    });

    this.isRunning = true;
    console.log(`💾 Serviço de backup iniciado - Agendado para: ${this.backupSchedule}`);
    
    // Log do sistema
    auditLogger.logSystemEvent({
      event: 'BACKUP_SERVICE_STARTED',
      component: 'BACKUP',
      level: 'INFO',
      message: 'Serviço de backup automático iniciado',
      metadata: {
        schedule: this.backupSchedule,
        backupDir: this.backupDir,
        maxBackups: this.maxBackups
      }
    }).catch(console.error);
  }

  // Parar serviço de backup
  stop() {
    this.isRunning = false;
    console.log('🛑 Serviço de backup parado');
  }

  // Criar backup do banco de dados
  async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `backup_${this.dbConfig.database}_${timestamp}.sql`;
    const backupPath = path.join(this.backupDir, backupFileName);
    
    try {
      console.log('💾 Iniciando backup do banco de dados...');
      
      // Comando pg_dump para criar backup
      const pgDumpCommand = this.buildPgDumpCommand(backupPath);
      
      // Executar backup
      const { stdout, stderr } = await execAsync(pgDumpCommand, {
        env: {
          ...process.env,
          PGPASSWORD: this.dbConfig.password
        },
        timeout: 300000 // 5 minutos de timeout
      });
      
      // Verificar se o arquivo foi criado
      const stats = await fs.stat(backupPath);
      
      if (stats.size === 0) {
        throw new Error('Arquivo de backup está vazio');
      }
      
      console.log(`✅ Backup criado com sucesso: ${backupFileName} (${this.formatBytes(stats.size)})`);
      
      // Log de auditoria
      await auditLogger.logSystemEvent({
        event: 'BACKUP_CREATED',
        component: 'BACKUP',
        level: 'INFO',
        message: 'Backup do banco de dados criado com sucesso',
        metadata: {
          fileName: backupFileName,
          filePath: backupPath,
          fileSize: stats.size,
          database: this.dbConfig.database,
          timestamp: new Date().toISOString()
        }
      });
      
      // Limpar backups antigos
      await this.cleanOldBackups();
      
      return {
        success: true,
        fileName: backupFileName,
        filePath: backupPath,
        fileSize: stats.size
      };
      
    } catch (error) {
      console.error('❌ Erro ao criar backup:', error.message);
      
      // Log de erro
      await auditLogger.logSystemEvent({
        event: 'BACKUP_FAILED',
        component: 'BACKUP',
        level: 'ERROR',
        message: `Falha ao criar backup: ${error.message}`,
        metadata: {
          error: error.message,
          database: this.dbConfig.database,
          timestamp: new Date().toISOString()
        }
      });
      
      throw error;
    }
  }

  // Construir comando pg_dump
  buildPgDumpCommand(backupPath) {
    const options = [
      '--verbose',
      '--clean',
      '--no-owner',
      '--no-privileges',
      '--format=plain',
      `--host=${this.dbConfig.host}`,
      `--port=${this.dbConfig.port}`,
      `--username=${this.dbConfig.username}`,
      `--dbname=${this.dbConfig.database}`,
      `--file="${backupPath}"`
    ];
    
    return `pg_dump ${options.join(' ')}`;
  }

  // Limpar backups antigos
  async cleanOldBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files
        .filter(file => file.startsWith('backup_') && file.endsWith('.sql'))
        .map(file => ({
          name: file,
          path: path.join(this.backupDir, file)
        }));
      
      if (backupFiles.length <= this.maxBackups) {
        return; // Não há backups suficientes para limpar
      }
      
      // Ordenar por data de modificação (mais antigos primeiro)
      const filesWithStats = await Promise.all(
        backupFiles.map(async file => {
          const stats = await fs.stat(file.path);
          return { ...file, mtime: stats.mtime };
        })
      );
      
      filesWithStats.sort((a, b) => a.mtime - b.mtime);
      
      // Remover backups mais antigos
      const filesToDelete = filesWithStats.slice(0, filesWithStats.length - this.maxBackups);
      
      for (const file of filesToDelete) {
        await fs.unlink(file.path);
        console.log(`🗑️ Backup antigo removido: ${file.name}`);
        
        // Log de auditoria
        await auditLogger.logSystemEvent({
          event: 'BACKUP_DELETED',
          component: 'BACKUP',
          level: 'INFO',
          message: 'Backup antigo removido automaticamente',
          metadata: {
            fileName: file.name,
            filePath: file.path,
            timestamp: new Date().toISOString()
          }
        });
      }
      
    } catch (error) {
      console.error('❌ Erro ao limpar backups antigos:', error);
    }
  }

  // Listar backups disponíveis
  async listBackups() {
    try {
      const files = await fs.readdir(this.backupDir);
      const backupFiles = files.filter(file => file.startsWith('backup_') && file.endsWith('.sql'));
      
      const backupsWithInfo = await Promise.all(
        backupFiles.map(async file => {
          const filePath = path.join(this.backupDir, file);
          const stats = await fs.stat(filePath);
          
          return {
            fileName: file,
            filePath,
            size: stats.size,
            sizeFormatted: this.formatBytes(stats.size),
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime
          };
        })
      );
      
      // Ordenar por data de criação (mais recentes primeiro)
      backupsWithInfo.sort((a, b) => b.createdAt - a.createdAt);
      
      return backupsWithInfo;
      
    } catch (error) {
      console.error('❌ Erro ao listar backups:', error);
      throw error;
    }
  }

  // Restaurar backup
  async restoreBackup(backupFileName) {
    const backupPath = path.join(this.backupDir, backupFileName);
    
    try {
      // Verificar se o arquivo existe
      await fs.access(backupPath);
      
      console.log(`🔄 Iniciando restauração do backup: ${backupFileName}`);
      
      // Comando psql para restaurar backup
      const psqlCommand = this.buildPsqlCommand(backupPath);
      
      // Executar restauração
      const { stdout, stderr } = await execAsync(psqlCommand, {
        env: {
          ...process.env,
          PGPASSWORD: this.dbConfig.password
        },
        timeout: 600000 // 10 minutos de timeout
      });
      
      console.log(`✅ Backup restaurado com sucesso: ${backupFileName}`);
      
      // Log de auditoria
      await auditLogger.logSystemEvent({
        event: 'BACKUP_RESTORED',
        component: 'BACKUP',
        level: 'INFO',
        message: 'Backup restaurado com sucesso',
        metadata: {
          fileName: backupFileName,
          filePath: backupPath,
          database: this.dbConfig.database,
          timestamp: new Date().toISOString()
        }
      });
      
      return {
        success: true,
        fileName: backupFileName,
        message: 'Backup restaurado com sucesso'
      };
      
    } catch (error) {
      console.error('❌ Erro ao restaurar backup:', error.message);
      
      // Log de erro
      await auditLogger.logSystemEvent({
        event: 'BACKUP_RESTORE_FAILED',
        component: 'BACKUP',
        level: 'ERROR',
        message: `Falha ao restaurar backup: ${error.message}`,
        metadata: {
          fileName: backupFileName,
          error: error.message,
          database: this.dbConfig.database,
          timestamp: new Date().toISOString()
        }
      });
      
      throw error;
    }
  }

  // Construir comando psql para restauração
  buildPsqlCommand(backupPath) {
    const options = [
      `--host=${this.dbConfig.host}`,
      `--port=${this.dbConfig.port}`,
      `--username=${this.dbConfig.username}`,
      `--dbname=${this.dbConfig.database}`,
      `--file="${backupPath}"`
    ];
    
    return `psql ${options.join(' ')}`;
  }

  // Formatar bytes em formato legível
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Obter status do serviço
  getStatus() {
    return {
      isRunning: this.isRunning,
      schedule: this.backupSchedule,
      backupDir: this.backupDir,
      maxBackups: this.maxBackups,
      dbConfig: {
        host: this.dbConfig.host,
        port: this.dbConfig.port,
        database: this.dbConfig.database,
        username: this.dbConfig.username
      }
    };
  }
}

module.exports = new BackupService();
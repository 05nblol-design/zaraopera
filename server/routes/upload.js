const express = require('express');
const { body, validationResult, param } = require('express-validator');
const pool = require('../config/database');
const path = require('path');
const fs = require('fs').promises;
const { requireOperator } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');

const router = express.Router();

// Configurações
const UPLOAD_DIR = path.join(__dirname, '../uploads');
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Garantir que o diretório de upload existe
const ensureUploadDir = async () => {
  try {
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.mkdir(path.join(UPLOAD_DIR, 'images'), { recursive: true });
    await fs.mkdir(path.join(UPLOAD_DIR, 'videos'), { recursive: true });
    await fs.mkdir(path.join(UPLOAD_DIR, 'avatars'), { recursive: true });
  } catch (error) {
    console.error('Erro ao criar diretórios de upload:', error);
  }
};

// @desc    Upload de imagem para teste de qualidade
// @route   POST /api/upload/quality-test-image
// @access  Private (Operator)
router.post('/quality-test-image', requireOperator, asyncHandler(async (req, res) => {
  await ensureUploadDir();

  if (!req.files || !req.files.image) {
    throw new AppError('Nenhuma imagem foi enviada', 400, 'NO_IMAGE_PROVIDED');
  }

  const image = req.files.image;

  // Validar tipo de arquivo
  if (!ALLOWED_IMAGE_TYPES.includes(image.mimetype)) {
    throw new AppError('Tipo de arquivo não permitido. Use JPEG, PNG ou WebP', 400, 'INVALID_FILE_TYPE');
  }

  // Validar tamanho
  if (image.size > MAX_FILE_SIZE) {
    throw new AppError('Arquivo muito grande. Máximo 10MB', 400, 'FILE_TOO_LARGE');
  }

  const timestamp = Date.now();
  const extension = path.extname(image.name);
  const filename = `quality_test_${timestamp}_${req.user.id}${extension}`;
  const filepath = path.join(UPLOAD_DIR, 'images', filename);

  try {
    // Mover arquivo
    await image.mv(filepath);

    // URL pública do arquivo
    const fileUrl = `/uploads/images/${filename}`;

    // Log da ação
    await pool.query(`
      INSERT INTO "SystemLog" (action, "userId", details, "createdAt")
      VALUES ($1, $2, $3, NOW())
    `, [
      'IMAGE_UPLOADED',
      req.user.id,
      JSON.stringify({
        filename,
        originalName: image.name,
        size: image.size,
        mimetype: image.mimetype,
        purpose: 'quality_test',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      })
    ]);

    res.json({
      success: true,
      message: 'Imagem enviada com sucesso',
      data: {
        filename,
        url: fileUrl,
        size: image.size,
        mimetype: image.mimetype
      }
    });
  } catch (error) {
    throw new AppError('Erro ao salvar imagem', 500, 'UPLOAD_ERROR');
  }
}));

// @desc    Upload de vídeo para teste de qualidade
// @route   POST /api/upload/quality-test-video
// @access  Private (Operator)
router.post('/quality-test-video', requireOperator, asyncHandler(async (req, res) => {
  await ensureUploadDir();

  if (!req.files || !req.files.video) {
    throw new AppError('Nenhum vídeo foi enviado', 400, 'NO_VIDEO_PROVIDED');
  }

  const video = req.files.video;

  // Validar tipo de arquivo
  if (!ALLOWED_VIDEO_TYPES.includes(video.mimetype)) {
    throw new AppError('Tipo de arquivo não permitido. Use MP4, WebM ou QuickTime', 400, 'INVALID_FILE_TYPE');
  }

  // Validar tamanho (50MB para vídeos)
  const maxVideoSize = 50 * 1024 * 1024; // 50MB para vídeos
  if (video.size > maxVideoSize) {
    throw new AppError('Arquivo muito grande. Máximo 50MB para vídeos', 400, 'FILE_TOO_LARGE');
  }

  const timestamp = Date.now();
  const extension = path.extname(video.name);
  const filename = `quality_test_video_${timestamp}_${req.user.id}${extension}`;
  const filepath = path.join(UPLOAD_DIR, 'videos', filename);

  try {
    // Mover arquivo
    await video.mv(filepath);

    // URL pública do arquivo
    const fileUrl = `/uploads/videos/${filename}`;

    // Log da ação
    await pool.query(`
      INSERT INTO "SystemLog" (action, "userId", details, "createdAt")
      VALUES ($1, $2, $3, NOW())
    `, [
      'VIDEO_UPLOADED',
      req.user.id,
      JSON.stringify({
        filename,
        originalName: video.name,
        size: video.size,
        mimetype: video.mimetype,
        purpose: 'quality_test',
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      })
    ]);

    res.json({
      success: true,
      message: 'Vídeo enviado com sucesso',
      data: {
        filename,
        url: fileUrl,
        size: video.size,
        mimetype: video.mimetype
      }
    });
  } catch (error) {
    throw new AppError('Erro ao salvar vídeo', 500, 'UPLOAD_ERROR');
  }
}));

module.exports = router;
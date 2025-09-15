const { validationResult } = require('express-validator');

/**
 * Middleware para validar requisições usando express-validator
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value
    }));

    return res.status(400).json({
      success: false,
      message: 'Dados de entrada inválidos',
      errors: formattedErrors
    });
  }

  next();
};

/**
 * Middleware para sanitizar dados de entrada
 * Remove campos undefined, null e strings vazias
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
const sanitizeInput = (req, res, next) => {
  const sanitizeObject = (obj) => {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined && value !== null && value !== '') {
        if (typeof value === 'object' && !Array.isArray(value)) {
          sanitized[key] = sanitizeObject(value);
        } else if (Array.isArray(value)) {
          sanitized[key] = value.filter(item => item !== undefined && item !== null && item !== '');
        } else {
          sanitized[key] = value;
        }
      }
    }
    return sanitized;
  };

  if (req.body) {
    req.body = sanitizeObject(req.body);
  }

  if (req.query) {
    req.query = sanitizeObject(req.query);
  }

  next();
};

/**
 * Middleware para validar paginação
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 */
const validatePagination = (req, res, next) => {
  const { page = 1, limit = 10 } = req.query;
  
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  
  if (isNaN(pageNum) || pageNum < 1) {
    return res.status(400).json({
      success: false,
      message: 'Página deve ser um número positivo'
    });
  }
  
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    return res.status(400).json({
      success: false,
      message: 'Limite deve ser um número entre 1 e 100'
    });
  }
  
  req.pagination = {
    page: pageNum,
    limit: limitNum,
    skip: (pageNum - 1) * limitNum
  };
  
  next();
};

/**
 * Middleware para validar IDs numéricos
 * @param {string} paramName - Nome do parâmetro a ser validado
 * @returns {Function} Middleware function
 */
const validateNumericId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];
    
    if (!id || isNaN(parseInt(id)) || parseInt(id) < 1) {
      return res.status(400).json({
        success: false,
        message: `${paramName} deve ser um número positivo válido`
      });
    }
    
    req.params[paramName] = parseInt(id);
    next();
  };
};

/**
 * Middleware para validar campos obrigatórios
 * @param {Array} requiredFields - Array com nomes dos campos obrigatórios
 * @returns {Function} Middleware function
 */
const validateRequiredFields = (requiredFields) => {
  return (req, res, next) => {
    const missingFields = [];
    
    requiredFields.forEach(field => {
      if (!req.body[field] && req.body[field] !== 0 && req.body[field] !== false) {
        missingFields.push(field);
      }
    });
    
    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Campos obrigatórios não fornecidos',
        missingFields
      });
    }
    
    next();
  };
};

/**
 * Middleware para validar tipos de dados
 * @param {Object} fieldTypes - Objeto com campo: tipo esperado
 * @returns {Function} Middleware function
 */
const validateFieldTypes = (fieldTypes) => {
  return (req, res, next) => {
    const typeErrors = [];
    
    Object.entries(fieldTypes).forEach(([field, expectedType]) => {
      const value = req.body[field];
      
      if (value !== undefined) {
        let isValid = false;
        
        switch (expectedType) {
          case 'string':
            isValid = typeof value === 'string';
            break;
          case 'number':
            isValid = typeof value === 'number' && !isNaN(value);
            break;
          case 'boolean':
            isValid = typeof value === 'boolean';
            break;
          case 'array':
            isValid = Array.isArray(value);
            break;
          case 'object':
            isValid = typeof value === 'object' && value !== null && !Array.isArray(value);
            break;
          default:
            isValid = true;
        }
        
        if (!isValid) {
          typeErrors.push({
            field,
            expectedType,
            receivedType: Array.isArray(value) ? 'array' : typeof value
          });
        }
      }
    });
    
    if (typeErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Tipos de dados inválidos',
        typeErrors
      });
    }
    
    next();
  };
};

module.exports = {
  validateRequest,
  sanitizeInput,
  validatePagination,
  validateNumericId,
  validateRequiredFields,
  validateFieldTypes
};
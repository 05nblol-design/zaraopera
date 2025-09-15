import React, { useRef, useState } from 'react';
import { PhotoIcon, VideoCameraIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';

const MediaUpload = ({ 
  media = [], 
  onMediaAdd, 
  onMediaRemove, 
  maxFiles = 10,
  acceptedTypes = ['image/*', 'video/*'],
  maxFileSize = 10 * 1024 * 1024,
  className = ''
}) => {
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleChange = (e) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const handleFiles = (files) => {
    const fileArray = Array.from(files);
    
    fileArray.forEach((file) => {
      if (media.length >= maxFiles) {
        toast.error(`Máximo de ${maxFiles} arquivos permitidos`);
        return;
      }

      if (file.size > maxFileSize) {
        toast.error(`Arquivo muito grande. Máximo ${maxFileSize / (1024 * 1024)}MB`);
        return;
      }

      const isValidType = acceptedTypes.some(type => {
        if (type === 'image/*') return file.type.startsWith('image/');
        if (type === 'video/*') return file.type.startsWith('video/');
        return file.type === type;
      });

      if (!isValidType) {
        toast.error('Tipo de arquivo não suportado');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const mediaItem = {
          id: Date.now() + Math.random(),
          name: file.name,
          size: file.size,
          type: file.type.startsWith('image/') ? 'image' : 'video',
          file: file,
          preview: e.target.result
        };
        onMediaAdd(mediaItem);
      };
      reader.readAsDataURL(file);
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const openFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Area */}
      <div
        className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
          dragActive
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleChange}
          className="hidden"
        />
        
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <PhotoIcon className="h-12 w-12 text-gray-400" />
          </div>
          <div className="flex text-sm text-gray-600 dark:text-gray-400">
            <button
              type="button"
              onClick={openFileDialog}
              className="relative cursor-pointer bg-white dark:bg-gray-800 rounded-md font-medium text-blue-600 hover:text-blue-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500"
            >
              <span>Clique para fazer upload</span>
            </button>
            <p className="pl-1">ou arraste e solte</p>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            PNG, JPG, MP4 até {maxFileSize / (1024 * 1024)}MB
          </p>
        </div>
      </div>

      {/* Media Preview */}
      {media.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {media.map((item) => (
            <div key={item.id} className="relative group">
              <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                {item.type === 'image' ? (
                  <img
                    src={item.preview}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <VideoCameraIcon className="h-12 w-12 text-gray-400" />
                  </div>
                )}
              </div>
              
              {/* Remove Button */}
              <button
                type="button"
                onClick={() => onMediaRemove(item.id)}
                className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
              
              {/* File Info */}
              <div className="mt-2">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {item.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatFileSize(item.size)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* File Count */}
      <div className="text-sm text-gray-500 dark:text-gray-400">
        {media.length} de {maxFiles} arquivos
      </div>
    </div>
  );
};

export default MediaUpload;
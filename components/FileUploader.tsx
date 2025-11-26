
import React, { useCallback, useState } from 'react';
import { Icons } from './Icons';

interface FileUploaderProps {
  files: File[];
  onFileChange: (files: File[]) => void;
  onRemoveFile: (fileName: string) => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ files, onFileChange, onRemoveFile }) => {
  const [isDragging, setIsDragging] = useState(false);

  const acceptedFileTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];

  const filterFiles = (newFiles: File[]): File[] => {
    return newFiles.filter(file => acceptedFileTypes.includes(file.type));
  };

  const handleDragEnter = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const droppedFiles: File[] = Array.from(e.dataTransfer.files);
    const validFiles = filterFiles(droppedFiles);
    
    if (validFiles.length > 0) {
      // Avoid duplicates based on name
      const existingNames = new Set(files.map(f => f.name));
      const uniqueFiles = validFiles.filter(f => !existingNames.has(f.name));
      
      if (uniqueFiles.length > 0) {
          onFileChange([...files, ...uniqueFiles]);
      }
    }
  }, [onFileChange, files]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles: File[] = Array.from(e.target.files || []);
    const validFiles = filterFiles(selectedFiles);
    
    if (validFiles.length > 0) {
      const existingNames = new Set(files.map(f => f.name));
      const uniqueFiles = validFiles.filter(f => !existingNames.has(f.name));

      if (uniqueFiles.length > 0) {
          onFileChange([...files, ...uniqueFiles]);
      }
    }
    // Réinitialise pour permettre la sélection du même fichier à nouveau
    e.target.value = '';
  };

  return (
    <div>
      <label
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-300
          ${isDragging ? 'border-emerald-400 bg-slate-700' : 'border-slate-600 bg-slate-800 hover:bg-slate-700'}`}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <Icons.UploadCloud className={`w-10 h-10 mb-2 ${isDragging ? 'text-emerald-400' : 'text-slate-400'}`} />
          <p className="mb-1 text-sm text-slate-400 text-center">
            <span className="font-semibold text-emerald-400">Cliquez</span> ou glissez
          </p>
          <p className="text-[10px] text-slate-500">Img/PDF</p>
        </div>
        <input 
          id="dropzone-file" 
          type="file" 
          className="hidden" 
          multiple 
          accept={acceptedFileTypes.join(',')}
          onChange={handleFileSelect}
        />
      </label>

      {files.length > 0 && (
        <div className="mt-4 w-full">
          <h4 className="font-semibold text-sm text-slate-300 mb-2">Fichiers ({files.length}):</h4>
          <ul className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
            {files.map((file, index) => (
               <li key={`${file.name}-${index}`} className="flex items-center justify-between bg-slate-700/50 p-2 rounded border border-slate-700 group hover:border-slate-500 transition-colors">
                    <div className="flex items-center overflow-hidden mr-2">
                        <Icons.FilePdf className={`w-4 h-4 mr-2 flex-shrink-0 ${file.type === 'application/pdf' ? 'text-red-400' : 'text-emerald-400'}`} />
                        <span className="truncate text-xs text-slate-300" title={file.name}>{file.name}</span>
                    </div>
                    <button 
                        onClick={() => onRemoveFile(file.name)}
                        className="text-slate-500 hover:text-red-400 transition-colors p-1 rounded hover:bg-slate-700"
                        title="Retirer ce fichier"
                    >
                        <Icons.Trash className="w-4 h-4" />
                    </button>
                </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

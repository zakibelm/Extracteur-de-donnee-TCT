
import React, { useCallback, useState } from 'react';
import { Icons } from './Icons';

interface FileUploaderProps {
  onFileChange: (files: File[]) => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFileChange }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [fileNames, setFileNames] = useState<string[]>([]);

  const acceptedFileTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];

  const filterFiles = (files: File[]): File[] => {
    return files.filter(file => acceptedFileTypes.includes(file.type));
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
    // FIX: Explicitly type `droppedFiles` as `File[]` to fix type inference issue.
    const droppedFiles: File[] = Array.from(e.dataTransfer.files);
    const validFiles = filterFiles(droppedFiles);
    if (validFiles.length > 0) {
      setFileNames(validFiles.map((f: File) => f.name));
      onFileChange(validFiles);
    }
  }, [onFileChange]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    // FIX: Explicitly type `selectedFiles` as `File[]` to fix type inference issue.
    const selectedFiles: File[] = Array.from(e.target.files || []);
    const validFiles = filterFiles(selectedFiles);
    if (validFiles.length > 0) {
      setFileNames(validFiles.map((f: File) => f.name));
      onFileChange(validFiles);
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
        className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-300
          ${isDragging ? 'border-emerald-400 bg-slate-700' : 'border-slate-600 bg-slate-800 hover:bg-slate-700'}`}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <Icons.UploadCloud className={`w-10 h-10 mb-3 ${isDragging ? 'text-emerald-400' : 'text-slate-400'}`} />
          <p className="mb-2 text-sm text-slate-400">
            <span className="font-semibold text-emerald-400">Cliquez pour télécharger</span> ou glissez-déposez
          </p>
          <p className="text-xs text-slate-500">Images (PNG, JPG) ou PDF</p>
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
      {fileNames.length > 0 && (
        <div className="mt-4 text-sm text-slate-300">
          <h4 className="font-semibold">Fichiers sélectionnés:</h4>
          <ul className="list-disc list-inside pl-2 mt-1 max-h-24 overflow-y-auto">
            {fileNames.map((name, index) => <li key={index}>{name}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
};

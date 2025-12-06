
import React, { useCallback, useState } from 'react';
import { Icons } from './Icons';

interface FileUploaderProps {
  onFileChange: (files: File[]) => void;
  id?: string;
  showFileList?: boolean; // Nouvelle prop pour contrôler l'affichage de la liste
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFileChange, id = 'dropzone-file', showFileList = true }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [clickCount, setClickCount] = useState(0);
  const [changeCount, setChangeCount] = useState(0);
  const [lastAction, setLastAction] = useState<string>('En attente...');

  const acceptedFileTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];

  const filterFiles = (files: File[]): File[] => {
    return files.filter(file => acceptedFileTypes.includes(file.type));
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    setLastAction('📦 Drop détecté!');
    const droppedFiles: File[] = Array.from(e.dataTransfer.files);
    const validFiles = filterFiles(droppedFiles);
    if (validFiles.length > 0) {
      setFileNames(validFiles.map((f: File) => f.name));
      onFileChange(validFiles);
      setChangeCount(prev => prev + 1);
      setLastAction(`✅ ${validFiles.length} fichier(s) uploadé(s) via DROP`);
    }
  }, [onFileChange]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles: File[] = Array.from(e.target.files || []);
    setChangeCount(prev => prev + 1);
    setLastAction(`⚡ onChange DÉCLENCHÉ! ${selectedFiles.length} fichiers bruts`);

    console.log(`📁 [FileUploader id="${id}"] File input changed. Raw files:`, selectedFiles.length);
    const validFiles = filterFiles(selectedFiles);
    console.log(`✅ [FileUploader id="${id}"] Valid files after filter:`, validFiles.length, validFiles.map(f => f.name));

    if (validFiles.length > 0) {
      setFileNames(validFiles.map((f: File) => f.name));
      onFileChange(validFiles);
      setLastAction(`✅ ${validFiles.length} fichier(s) VALIDE(S) envoyé(s) au parent`);
      console.log(`🚀 [FileUploader id="${id}"] Calling onFileChange with`, validFiles.length, 'files');
    } else {
      setLastAction(`❌ Aucun fichier valide (types acceptés: PNG, JPG, PDF)`);
    }

    // Réinitialise pour permettre la sélection du même fichier à nouveau
    e.target.value = '';
  };

  const handleClick = () => {
    setClickCount(prev => prev + 1);
    setLastAction(`👆 Zone CLIQUÉE! (click #${clickCount + 1})`);
    document.getElementById(id)?.click();
  };

  return (
    <div>
      {/* DIAGNOSTIC VISUEL */}
      <div className="mb-4 p-4 bg-red-900/50 border-2 border-red-500 rounded-lg">
        <p className="text-red-200 font-bold text-lg mb-2">🔴 DIAGNOSTIC VISUEL - ID: {id}</p>
        <p className="text-yellow-300 font-mono text-sm">👆 Clics sur zone: {clickCount}</p>
        <p className="text-yellow-300 font-mono text-sm">⚡ onChange déclenché: {changeCount} fois</p>
        <p className="text-green-300 font-mono text-sm">📝 Dernière action: {lastAction}</p>
        <p className="text-blue-300 font-mono text-sm mt-2">
          ℹ️ Si ces compteurs ne bougent PAS après sélection, c'est un problème DOM/React
        </p>
      </div>

      <div
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-300
          ${isDragging ? 'border-emerald-400 bg-slate-700' : 'border-slate-600 bg-slate-800 hover:bg-slate-700'}`}
      >
        <Icons.UploadCloud className={`w-10 h-10 mb-3 ${isDragging ? 'text-emerald-400' : 'text-slate-400'}`} />
        <p className="mb-2 text-sm text-slate-400">
          <span className="font-semibold text-emerald-400">Cliquez pour télécharger</span> ou glissez-déposez
        </p>
        <p className="text-xs text-slate-500">Images (PNG, JPG) ou PDF</p>
      </div>

      <input
        id={id}
        type="file"
        className="hidden"
        multiple
        accept={acceptedFileTypes.join(',')}
        onChange={handleFileSelect}
      />

      {showFileList && fileNames.length > 0 && (
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

import React, { useRef } from 'react';
import { Button } from './Button';
import { Icons } from './Icons';

interface FileUploaderProps {
    onFileChange: (files: File[]) => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFileChange }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onFileChange(Array.from(e.target.files));
        }
    };

    return (
        <div className="border-2 border-dashed border-slate-600 rounded-lg p-6 flex flex-col items-center justify-center bg-slate-800/50 hover:bg-slate-800 transition-colors">
            <Icons.UploadCloud className="w-12 h-12 text-slate-400 mb-4" />
            <p className="text-slate-300 text-center mb-4">
                Glissez-déposez vos fichiers ici<br />
                <span className="text-sm text-slate-500">(PDF, Images)</span>
            </p>
            <input
                type="file"
                multiple
                accept="image/*,application/pdf"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
            />
            <Button
                onClick={() => fileInputRef.current?.click()}
                className="bg-slate-700 hover:bg-slate-600"
            >
                Sélectionner des fichiers
            </Button>
        </div>
    );
};

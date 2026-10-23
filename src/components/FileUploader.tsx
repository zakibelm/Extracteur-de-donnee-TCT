import React, { useRef, useState } from 'react';
import { Icons } from './Icons';
import { normalizeUploads, UPLOAD_ACCEPT } from '../utils/uploads';

interface FileUploaderProps {
    onFileChange: (files: File[]) => void;
    id?: string;
    showFileList?: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFileChange, id = 'dropzone-file', showFileList = true }) => {
    const input = useRef<HTMLInputElement>(null);
    const [dragging, setDragging] = useState(false);
    const [names, setNames] = useState<string[]>([]);
    const [errors, setErrors] = useState<string[]>([]);
    const select = (files: File[]) => {
        if (!files.length) return; // Cancelling preserves the previous selection.
        const result = normalizeUploads(files);
        setErrors(result.errors);
        if (result.files.length) {
            setNames(result.files.map(file => file.name));
            onFileChange(result.files);
        }
    };
    return <div>
        <button type="button" onClick={() => input.current?.click()}
            onDragOver={event => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={event => { event.preventDefault(); setDragging(false); select(Array.from(event.dataTransfer.files)); }}
            className={`flex flex-col items-center justify-center w-full min-h-40 p-4 border-2 border-dashed rounded-lg ${dragging ? 'border-emerald-400 bg-slate-700' : 'border-slate-600 bg-slate-800 hover:bg-slate-700'}`}>
            <Icons.UploadCloud className="w-9 h-9 mb-3 text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-400">Choisir un document</span>
            <span className="text-xs text-slate-400 mt-2">PNG, JPG, WEBP ou PDF — 50 Mo maximum</span>
        </button>
        <input ref={input} id={id} aria-label="Document à analyser" type="file" className="hidden" multiple
            accept={UPLOAD_ACCEPT} onChange={event => { select(Array.from(event.currentTarget.files || [])); event.currentTarget.value = ''; }} />
        {errors.length > 0 && <p role="alert" className="text-xs text-red-300 mt-2 whitespace-pre-line">{errors.join('\n')}</p>}
        {showFileList && names.length > 0 && <ul className="text-xs text-slate-300 mt-2">{names.map((name, i) => <li key={i}>{name}</li>)}</ul>}
        {names.length > 0 && <p role="status" className="text-xs text-emerald-300 mt-2">Document prêt. Cliquez sur « Lancer » pour analyser.</p>}
    </div>;
};

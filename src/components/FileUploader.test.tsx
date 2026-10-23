import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { FileUploader } from './FileUploader';
let host: HTMLDivElement;
let root: Root;
beforeEach(() => { (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.append(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });
const choose = (files: File[]) => {
    const input = host.querySelector('input')!;
    Object.defineProperty(input, 'files', { configurable: true, value: files });
    act(() => input.dispatchEvent(new Event('change', { bubbles: true })));
};
it('passes an Android file selection to the parent and allows selecting it again', () => {
    const onFileChange = vi.fn();
    act(() => root.render(<FileUploader onFileChange={onFileChange} />));
    const image = new File(['abc'], 'capture.jpg');
    choose([image]); choose([image]);
    expect(onFileChange).toHaveBeenCalledTimes(2);
    expect(onFileChange.mock.calls[0][0][0].type).toBe('image/jpeg');
    expect(host.querySelector('[role="status"]')?.textContent).toContain('Document prêt');
});
it('shows an actionable message for rejected files', () => {
    const onFileChange = vi.fn();
    act(() => root.render(<FileUploader onFileChange={onFileChange} />));
    choose([new File(['x'], 'document.doc')]);
    expect(onFileChange).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('PNG');
});

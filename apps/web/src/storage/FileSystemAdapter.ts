// Type declarations for File System Access API
declare global {
  interface Window {
    showOpenFilePicker(options?: any): Promise<FileSystemFileHandle[]>;
    showSaveFilePicker(options?: any): Promise<FileSystemFileHandle>;
  }
  interface FileSystemFileHandle {
    getFile(): Promise<File>;
    createWritable(): Promise<FileSystemWritableFileStream>;
  }
  interface FileSystemWritableFileStream {
    write(data: string | BufferSource | Blob): Promise<void>;
    close(): Promise<void>;
  }
}

export class FileSystemAdapter {
  private fileHandle: FileSystemFileHandle | null = null;

  async openFile(): Promise<string> {
    const handles = await window.showOpenFilePicker({
      types: [
        {
          description: 'ERD Forge Project',
          accept: {
            'application/json': ['.erdforge'],
          },
        },
      ],
    });
    
    if (!handles || handles.length === 0) {
      throw new Error("No file selected");
    }
    
    const handle = handles[0];
    if (!handle) {
      throw new Error("No file selected");
    }
    
    this.fileHandle = handle;
    const file = await handle.getFile();
    return await file.text();
  }

  async saveFile(content: string, saveAs: boolean = false): Promise<void> {
    if (saveAs || !this.fileHandle) {
      const handle = await window.showSaveFilePicker({
        types: [
          {
            description: 'ERD Forge Project',
            accept: {
              'application/json': ['.erdforge'],
            },
          },
        ],
      });
      if (!handle) throw new Error("No file selected for save");
      this.fileHandle = handle as FileSystemFileHandle;
    }

    if (!this.fileHandle) throw new Error("File handle not available");

    const writable = await this.fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  }
}


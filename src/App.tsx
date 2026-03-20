import React, { useState, useEffect, useCallback, useRef } from 'react';
import JSZip from 'jszip';
import { get, set } from 'idb-keyval';
import { ImageItem, AppState, WatermarkInstance } from './types';
import { ImageCard } from './components/ImageCard';
import { Upload, Download, Trash2, CheckSquare, Square, Image as ImageIcon, Settings, Droplets, Minimize, Loader2 } from 'lucide-react';

const generateRandomWatermark = (): WatermarkInstance => ({
  x: Math.random() * 0.8 + 0.1,
  y: Math.random() * 0.8 + 0.1,
  scale: 0.2,
  opacity: 0.5,
  negative: false,
});

export default function App() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [watermark, setWatermark] = useState<string | null>(null);
  const [maxSize, setMaxSize] = useState<number>(1920);
  const [quality, setQuality] = useState<number>(0.8);
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingWm, setIsDraggingWm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const watermarkInputRef = useRef<HTMLInputElement>(null);

  // Load state from IndexedDB on mount
  useEffect(() => {
    const loadState = async () => {
      try {
        const savedState = await get<any>('appState');
        if (savedState) {
          const migratedImages = (savedState.images || []).map((img: any) => {
            if ('watermarks' in img) {
              const wm = img.watermarks.length > 0 ? img.watermarks[img.watermarks.length - 1] : null;
              delete img.watermarks;
              return { ...img, watermarkPosition: wm };
            }
            return img;
          });
          setImages(migratedImages);
          setWatermark(savedState.watermark || null);
          setMaxSize(savedState.maxSize || 1920);
          setQuality(savedState.quality || 0.8);
        }
      } catch (e) {
        console.error('Failed to load state', e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadState();
  }, []);

  // Save state to IndexedDB on change
  useEffect(() => {
    if (!isLoaded) return;
    const saveState = async () => {
      try {
        await set('appState', { images, watermark, maxSize, quality });
      } catch (e) {
        console.error('Failed to save state', e);
      }
    };
    saveState();
  }, [images, watermark, maxSize, quality, isLoaded]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processFiles = async (files: FileList | File[]) => {
    setIsProcessing(true);
    try {
      const newImages: ImageItem[] = [];
      
      for (const file of Array.from(files)) {
        if (file.name.toLowerCase().endsWith('.zip')) {
          const zip = new JSZip();
          const contents = await zip.loadAsync(file);
          for (const [filename, zipEntry] of Object.entries(contents.files)) {
            if (!zipEntry.dir && filename.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
              const blob = await zipEntry.async('blob');
              const dataUrl = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
              });
              newImages.push({
                id: filename, // Use exact filename as unique ID
                name: filename.split('/').pop() || filename,
                dataUrl,
                selected: false,
                watermarkPosition: null,
                compress: true,
              });
            }
          }
        } else if (file.type.startsWith('image/')) {
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(file);
          });
          newImages.push({
            id: file.name, // Use exact filename as unique ID
            name: file.name,
            dataUrl,
            selected: false,
            watermarkPosition: null,
            compress: true,
          });
        }
      }
      
      setImages(prev => {
        const nextImages = [...prev];
        for (const newImg of newImages) {
          const existingIndex = nextImages.findIndex(img => img.id === newImg.id);
          if (existingIndex >= 0) {
            // Overwrite existing image with the same filename
            nextImages[existingIndex] = newImg;
          } else {
            nextImages.push(newImg);
          }
        }
        return nextImages;
      });
    } catch (e) {
      console.error('Failed to process files', e);
      alert('Failed to process some files');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
    e.target.value = '';
  };

  const handleWatermarkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      setWatermark(reader.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleWmDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingWm(true);
  };

  const handleWmDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingWm(false);
  };

  const handleWmDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingWm(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setWatermark(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const processSingleImage = async (item: ImageItem): Promise<{ name: string, blob: Blob }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (item.compress) {
          const maxDim = Math.max(width, height);
          if (maxDim > maxSize) {
            const ratio = maxSize / maxDim;
            width *= ratio;
            height *= ratio;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('No canvas context');

        ctx.drawImage(img, 0, 0, width, height);

        const applyWatermarksAndExport = () => {
          if (item.compress) {
            canvas.toBlob((blob) => {
              if (blob) {
                const newName = item.name.replace(/\.[^/.]+$/, "") + ".webp";
                resolve({ name: newName, blob });
              } else reject('Blob creation failed');
            }, 'image/webp', quality);
          } else {
            const ext = item.name.split('.').pop()?.toLowerCase();
            const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
            canvas.toBlob((blob) => {
              if (blob) resolve({ name: item.name, blob });
              else reject('Blob creation failed');
            }, mime, 0.95);
          }
        };

        if (watermark && item.watermarkPosition) {
          const wmImg = new Image();
          wmImg.onload = () => {
            const wm = item.watermarkPosition!;
            const wmSize = Math.max(width, height) * wm.scale;
            const wmRatio = wmImg.height / wmImg.width;
            const wmWidth = wmSize;
            const wmHeight = wmSize * wmRatio;
            
            const x = wm.x * width - wmWidth / 2;
            const y = wm.y * height - wmHeight / 2;
            
            ctx.save();
            ctx.globalAlpha = wm.opacity;
            if (wm.negative) {
              ctx.filter = 'invert(100%)';
            }
            ctx.drawImage(wmImg, x, y, wmWidth, wmHeight);
            ctx.restore();
            
            applyWatermarksAndExport();
          };
          wmImg.onerror = () => applyWatermarksAndExport();
          wmImg.src = watermark;
        } else {
          applyWatermarksAndExport();
        }
      };
      img.onerror = reject;
      img.src = item.dataUrl;
    });
  };

  const handleDownload = async () => {
    if (images.length === 0) return;
    setIsProcessing(true);
    try {
      const zip = new JSZip();
      
      // Process sequentially to avoid memory issues with many large images
      for (const item of images) {
        try {
          const { name, blob } = await processSingleImage(item);
          zip.file(name, blob);
        } catch (e) {
          console.error(`Failed to process ${item.name}`, e);
        }
      }
      
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'processed_images.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Download failed', e);
      alert('Failed to generate zip file');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadSingleImage = async (item: ImageItem) => {
    setIsProcessing(true);
    try {
      const { name, blob } = await processSingleImage(item);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(`Failed to process ${item.name}`, e);
      alert(`Failed to download ${item.name}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Mass operations
  const toggleSelectAll = () => {
    const allSelected = images.length > 0 && images.every(i => i.selected);
    setImages(images.map(i => ({ ...i, selected: !allSelected })));
  };

  const deleteSelected = () => {
    setImages(images.filter(i => !i.selected));
  };

  const compressSelected = (compress: boolean) => {
    setImages(images.map(i => i.selected ? { ...i, compress } : i));
  };

  const watermarkSelected = () => {
    if (!watermark) {
      alert('Please upload a watermark first');
      return;
    }
    setImages(images.map(i => i.selected ? { ...i, watermarkPosition: generateRandomWatermark() } : i));
  };

  const clearWatermarksSelected = () => {
    setImages(images.map(i => i.selected ? { ...i, watermarkPosition: null } : i));
  };

  // Individual operations
  const toggleSelect = (id: string) => {
    setImages(images.map(i => i.id === id ? { ...i, selected: !i.selected } : i));
  };

  const addWatermark = (id: string) => {
    if (!watermark) {
      alert('Please upload a watermark first');
      return;
    }
    setImages(images.map(i => i.id === id ? { ...i, watermarkPosition: generateRandomWatermark() } : i));
  };

  const setWatermarkPosition = (id: string, x: number, y: number) => {
    if (!watermark) {
      alert('Please upload a watermark first');
      return;
    }
    setImages(images.map(i => i.id === id ? { 
      ...i, 
      watermarkPosition: { 
        x, 
        y, 
        scale: i.watermarkPosition?.scale || 0.2,
        opacity: i.watermarkPosition?.opacity ?? 0.5,
        negative: i.watermarkPosition?.negative ?? false
      } 
    } : i));
  };

  const updateWatermarkSettings = (id: string, settings: Partial<WatermarkInstance>) => {
    setImages(images.map(i => i.id === id && i.watermarkPosition ? {
      ...i,
      watermarkPosition: { ...i.watermarkPosition, ...settings }
    } : i));
  };

  const toggleCompress = (id: string) => {
    setImages(images.map(i => i.id === id ? { ...i, compress: !i.compress } : i));
  };

  const deleteImage = (id: string) => {
    setImages(images.filter(i => i.id !== id));
  };

  if (!isLoaded) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900"><Loader2 className="animate-spin text-indigo-600 dark:text-indigo-400" size={32} /></div>;
  }

  const selectedCount = images.filter(i => i.selected).length;

  return (
    <div 
      className={`min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors ${isDragging ? 'bg-indigo-50 dark:bg-indigo-900/20' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header & Toolbar */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50 shadow-sm transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <ImageIcon className="text-indigo-600 dark:text-indigo-400" size={28} />
              <h1 className="text-xl font-semibold tracking-tight">Batch Image Processor</h1>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 rounded-lg font-medium text-sm transition-colors">
                <Upload size={16} />
                Upload Files
                <input type="file" accept=".zip,image/*" multiple className="hidden" onChange={handleFileInput} />
              </label>
              
              <label 
                className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 border rounded-lg font-medium text-sm transition-colors ${
                  isDraggingWm 
                    ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-400 text-indigo-700 dark:text-indigo-300' 
                    : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                onDragOver={handleWmDragOver}
                onDragLeave={handleWmDragLeave}
                onDrop={handleWmDrop}
              >
                <Droplets size={16} />
                {watermark ? 'Change Watermark' : 'Upload Watermark'}
                <input type="file" accept="image/png,image/jpeg" className="hidden" ref={watermarkInputRef} onChange={handleWatermarkUpload} />
              </label>

              <button 
                onClick={handleDownload}
                disabled={images.length === 0 || isProcessing}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-medium text-sm transition-colors shadow-sm"
              >
                {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                Download All
              </button>
            </div>
          </div>

          {/* Settings Bar */}
          <div className="mt-4 flex flex-col gap-3 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border border-gray-100 dark:border-gray-700/50 transition-colors">
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <Settings size={16} className="text-gray-400 dark:text-gray-500" />
                <span className="font-medium">Compression:</span>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="maxSize">Max Size (px):</label>
                <input 
                  id="maxSize"
                  type="number" 
                  value={maxSize} 
                  onChange={(e) => setMaxSize(Number(e.target.value))}
                  className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="quality">WebP Quality:</label>
                <input 
                  id="quality"
                  type="range" 
                  min="0.1" max="1" step="0.1" 
                  value={quality} 
                  onChange={(e) => setQuality(Number(e.target.value))}
                  className="w-24"
                />
                <span className="w-8 text-right">{Math.round(quality * 100)}%</span>
              </div>
            </div>
          </div>

          {/* Mass Operations Bar */}
          {images.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 py-2">
              <div className="flex items-center gap-3">
                <button onClick={toggleSelectAll} className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                  {images.every(i => i.selected) ? <CheckSquare size={18} /> : <Square size={18} />}
                  Select All
                </button>
                <span className="text-gray-300 dark:text-gray-600">|</span>
                <span className="text-sm text-gray-500 dark:text-gray-400">{selectedCount} selected</span>
              </div>
              
              {selectedCount > 0 && (
                <div className="flex items-center gap-2">
                  <button onClick={watermarkSelected} className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors">
                    Add Watermark
                  </button>
                  <button onClick={clearWatermarksSelected} className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors">
                    Clear Watermarks
                  </button>
                  <button onClick={() => compressSelected(true)} className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors">
                    Compress On
                  </button>
                  <button onClick={() => compressSelected(false)} className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors">
                    Compress Off
                  </button>
                  <button onClick={deleteSelected} className="px-3 py-1.5 text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded transition-colors ml-2">
                    Delete Selected
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isDragging && (
          <div className="fixed inset-0 z-40 bg-indigo-500/10 backdrop-blur-sm flex items-center justify-center border-4 border-indigo-500 border-dashed m-4 rounded-2xl pointer-events-none">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl flex flex-col items-center gap-4">
              <Upload size={48} className="text-indigo-500 dark:text-indigo-400 animate-bounce" />
              <p className="text-xl font-bold text-gray-800 dark:text-gray-100">Drop ZIP or Images here</p>
            </div>
          </div>
        )}

        {images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-24 h-24 bg-indigo-50 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mb-6">
              <Upload size={32} className="text-indigo-500 dark:text-indigo-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">No images yet</h2>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-8">
              Drag and drop a ZIP file or individual images anywhere on this page, or use the upload button above to get started.
            </p>
            <label className="cursor-pointer inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl font-medium transition-colors shadow-sm">
              <Upload size={20} />
              Select Files
              <input type="file" accept=".zip,image/*" multiple className="hidden" onChange={handleFileInput} />
            </label>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {images.map(item => (
              <ImageCard 
                key={item.id} 
                item={item} 
                watermarkUrl={watermark}
                watermarkScale={watermarkScale}
                watermarkOpacity={watermarkOpacity}
                watermarkNegative={watermarkNegative}
                onToggleSelect={() => toggleSelect(item.id)}
                onAddWatermark={() => addWatermark(item.id)}
                onSetWatermarkPosition={(x, y) => setWatermarkPosition(item.id, x, y)}
                onUpdateWatermarkSettings={(settings) => updateWatermarkSettings(item.id, settings)}
                onToggleCompress={() => toggleCompress(item.id)}
                onDelete={() => deleteImage(item.id)}
                onDownload={() => downloadSingleImage(item)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

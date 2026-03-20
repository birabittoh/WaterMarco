import React, { useState } from 'react';
import { ImageItem, WatermarkInstance } from '../types';
import { CheckSquare, Square, Download, Minimize, Trash2, Settings2 } from 'lucide-react';

interface Props {
  item: ImageItem;
  globalMaxSize: number;
  globalQuality: number;
  onToggleSelect: () => void;
  onAddWatermark: () => void;
  onSetWatermarkPosition: (x: number, y: number) => void;
  onUpdateWatermarkSettings: (settings: Partial<WatermarkInstance>) => void;
  onUpdateSettings: (settings: Partial<ImageItem>) => void;
  onToggleCompress: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onPreview: () => void;
  watermarkUrl: string | null;
}

export const ImageCard: React.FC<Props> = ({ 
  item, 
  globalMaxSize,
  globalQuality,
  onToggleSelect, 
  onAddWatermark, 
  onSetWatermarkPosition, 
  onUpdateWatermarkSettings, 
  onUpdateSettings,
  onToggleCompress, 
  onDelete, 
  onDownload, 
  onPreview,
  watermarkUrl 
}) => {
  const [showSettings, setShowSettings] = useState(false);

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!watermarkUrl) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    onSetWatermarkPosition(x, y);
  };

  return (
    <div className={`relative group border rounded-xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm transition-all ${item.selected ? 'ring-2 ring-indigo-500 border-indigo-500' : 'border-gray-200 dark:border-gray-700'}`}>
      <div className="aspect-square relative bg-gray-100 dark:bg-gray-900 flex items-center justify-center overflow-hidden">
        <img 
          src={item.dataUrl} 
          alt={item.name} 
          className={`max-w-full max-h-full object-contain ${watermarkUrl ? 'cursor-crosshair' : ''}`}
          onClick={handleImageClick}
          draggable={false}
        />
        
        {/* Render watermark preview */}
        {watermarkUrl && item.watermarkPosition && (
          <img 
            src={watermarkUrl} 
            alt="watermark" 
            className="absolute pointer-events-none"
            style={{
              left: `${item.watermarkPosition.x * 100}%`,
              top: `${item.watermarkPosition.y * 100}%`,
              width: `${(item.watermarkPosition.scale ?? 0.2) * 100}%`,
              opacity: item.watermarkPosition.opacity ?? 0.5,
              filter: item.watermarkPosition.negative ? 'invert(100%)' : 'none',
              transform: 'translate(-50%, -50%)'
            }}
          />
        )}

        {/* Top right corner button for download */}
        <button 
          onClick={(e) => { e.stopPropagation(); onDownload(); }} 
          className="absolute top-2 right-2 p-2 bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-700 rounded-full text-indigo-600 dark:text-indigo-400 shadow-md backdrop-blur-sm z-10" 
          title="Download Image"
        >
          <Download size={16} />
        </button>

        {/* Top left corner button for select */}
        <button 
          onClick={(e) => { e.stopPropagation(); onToggleSelect(); }} 
          className="absolute top-2 left-2 p-2 bg-white/80 dark:bg-gray-800/80 hover:bg-white dark:hover:bg-gray-700 rounded-full text-gray-700 dark:text-gray-300 shadow-md backdrop-blur-sm z-10"
        >
          {item.selected ? <CheckSquare size={16} className="text-indigo-600 dark:text-indigo-400" /> : <Square size={16} />}
        </button>

        {/* Bottom right corner button for compression */}
        <button 
          onClick={(e) => { e.stopPropagation(); onToggleCompress(); }} 
          className={`absolute bottom-2 right-2 p-2 rounded-full shadow-md backdrop-blur-sm z-10 ${item.compress ? 'bg-indigo-500 text-white hover:bg-indigo-600' : 'bg-white/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700'}`} 
          title="Toggle Compression"
        >
          <Minimize size={16} />
        </button>

        {/* Bottom left corner button for delete */}
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(); }} 
          className="absolute bottom-2 left-2 p-2 bg-white/80 dark:bg-gray-800/80 hover:bg-red-500 hover:text-white rounded-full text-red-500 dark:text-red-400 shadow-md backdrop-blur-sm z-10 opacity-0 group-hover:opacity-100 transition-opacity" 
          title="Delete"
        >
          <Trash2 size={16} />
        </button>

        {/* Settings toggle button */}
        <button 
          onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }} 
          className={`absolute bottom-2 left-1/2 -translate-x-1/2 p-2 rounded-full shadow-md backdrop-blur-sm z-10 opacity-0 group-hover:opacity-100 transition-opacity ${showSettings ? 'bg-indigo-500 text-white opacity-100' : 'bg-white/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700'}`} 
          title="Image Settings"
        >
          <Settings2 size={16} />
        </button>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="p-3 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-700 text-xs flex flex-col gap-3">
          {item.compress && (
            <>
              <div className="flex items-center justify-between gap-2">
                <label className="text-gray-600 dark:text-gray-400 font-medium">Max Size</label>
                <input 
                  type="number" 
                  value={item.maxSize ?? globalMaxSize} 
                  onChange={(e) => onUpdateSettings({ maxSize: Number(e.target.value) })}
                  className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <label className="text-gray-600 dark:text-gray-400 font-medium">Quality</label>
                <input 
                  type="range" 
                  min="0.1" max="1" step="0.1" 
                  value={item.quality ?? globalQuality} 
                  onChange={(e) => onUpdateSettings({ quality: Number(e.target.value) })}
                  className="flex-1"
                />
                <span className="w-8 text-right text-gray-500">{Math.round((item.quality ?? globalQuality) * 100)}%</span>
              </div>
              {item.watermarkPosition && <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />}
            </>
          )}
          
          {item.watermarkPosition && (
            <>
              <div className="flex items-center justify-between gap-2">
                <label className="text-gray-600 dark:text-gray-400 font-medium">WM Size</label>
                <input 
                  type="range" 
                  min="0.05" max="1" step="0.05" 
                  value={item.watermarkPosition.scale ?? 0.2} 
                  onChange={(e) => onUpdateWatermarkSettings({ scale: Number(e.target.value) })}
                  className="flex-1"
                />
                <span className="w-8 text-right text-gray-500">{Math.round((item.watermarkPosition.scale ?? 0.2) * 100)}%</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <label className="text-gray-600 dark:text-gray-400 font-medium">WM Opacity</label>
                <input 
                  type="range" 
                  min="0.1" max="1" step="0.1" 
                  value={item.watermarkPosition.opacity ?? 0.5} 
                  onChange={(e) => onUpdateWatermarkSettings({ opacity: Number(e.target.value) })}
                  className="flex-1"
                />
                <span className="w-8 text-right text-gray-500">{Math.round((item.watermarkPosition.opacity ?? 0.5) * 100)}%</span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-gray-600 dark:text-gray-400 font-medium">
                <input 
                  type="checkbox" 
                  checked={item.watermarkPosition.negative ?? false}
                  onChange={(e) => onUpdateWatermarkSettings({ negative: e.target.checked })}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                Negative (Invert)
              </label>
            </>
          )}
          {!item.compress && !item.watermarkPosition && (
            <div className="text-gray-500 italic text-center py-1">No active settings</div>
          )}
        </div>
      )}

      <div 
        className="p-3 text-xs text-gray-600 dark:text-gray-400 truncate bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline"
        title={item.name}
        onClick={(e) => { e.stopPropagation(); onPreview(); }}
      >
        {item.name}
      </div>
    </div>
  );
};

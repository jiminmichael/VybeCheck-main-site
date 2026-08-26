import React, { useState, useRef } from 'react';
import { X, Upload, Check, Link2, Camera } from 'lucide-react';

interface DJImageUploadModalProps {
  isOpen: boolean;
  title: string;
  currentImageUrl?: string;
  type: 'avatar' | 'cover';
  onClose: () => void;
  onSelectImage: (dataUrlOrLink: string) => void;
}

const PRESET_AVATARS = [
  {
    name: 'Afro Maestro',
    url: 'https://images.unsplash.com/photo-1571266028243-3716f02d2d2e?w=600&auto=format&fit=crop&q=80',
  },
  {
    name: 'Afrobeats Queen',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&auto=format&fit=crop&q=80',
  },
  {
    name: 'Hitmaker Cap',
    url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=600&auto=format&fit=crop&q=80',
  },
  {
    name: 'Turntablist',
    url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&auto=format&fit=crop&q=80',
  },
];

const PRESET_COVERS = [
  {
    name: 'Nightclub Crowd',
    url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=1200&auto=format&fit=crop&q=80',
  },
  {
    name: 'Festival Stage',
    url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=1200&auto=format&fit=crop&q=80',
  },
  {
    name: 'DJ Booth Turntables',
    url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&auto=format&fit=crop&q=80',
  },
];

export const DJImageUploadModal: React.FC<DJImageUploadModalProps> = ({
  isOpen,
  title,
  currentImageUrl,
  type,
  onClose,
  onSelectImage,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'presets' | 'url'>('upload');
  const [previewUrl, setPreviewUrl] = useState<string>(currentImageUrl || '');
  const [customUrl, setCustomUrl] = useState<string>('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleApply = () => {
    if (activeTab === 'url' && customUrl.trim()) {
      onSelectImage(customUrl.trim());
    } else if (previewUrl) {
      onSelectImage(previewUrl);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0E0E12] border border-[rgba(255,255,255,0.14)] rounded-2xl max-w-md w-full p-6 relative shadow-2xl space-y-5">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#8F8C88] hover:text-[#F5F2ED]"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[rgba(91,63,209,0.15)] border border-[#5B3FD1] flex items-center justify-center text-[#4D7CFE]">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-['Syne'] text-lg font-bold text-[#F5F2ED]">
              {title}
            </h3>
            <p className="text-xs text-[#8F8C88]">
              Upload image or choose a preset.
            </p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="grid grid-cols-3 gap-1 bg-[rgba(255,255,255,0.04)] p-1 rounded-xl border border-[rgba(255,255,255,0.06)]">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'upload'
                ? 'bg-[rgba(91,63,209,0.25)] text-[#F5F2ED] border border-[#5B3FD1]'
                : 'text-[#8F8C88] hover:text-[#F5F2ED]'
            }`}
          >
            Upload
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            className={`py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'presets'
                ? 'bg-[rgba(91,63,209,0.25)] text-[#F5F2ED] border border-[#5B3FD1]'
                : 'text-[#8F8C88] hover:text-[#F5F2ED]'
            }`}
          >
            Presets
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={`py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              activeTab === 'url'
                ? 'bg-[rgba(91,63,209,0.25)] text-[#F5F2ED] border border-[#5B3FD1]'
                : 'text-[#8F8C88] hover:text-[#F5F2ED]'
            }`}
          >
            URL
          </button>
        </div>

        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div className="space-y-4">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                dragOver
                  ? 'border-[#5B3FD1] bg-[rgba(91,63,209,0.1)]'
                  : 'border-[rgba(255,255,255,0.1)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(255,255,255,0.2)]'
              }`}
            >
              {previewUrl ? (
                <div className="space-y-2">
                  <img src={previewUrl} alt="Preview" className="w-20 h-20 mx-auto rounded-xl object-cover" />
                  <p className="text-xs text-[#4D7CFE]">Click to change</p>
                </div>
              ) : (
                <div className="space-y-2 text-[#8F8C88]">
                  <Upload className="w-6 h-6 mx-auto text-[#4D7CFE]" />
                  <p className="text-xs text-[#F5F2ED]">Click or drop image file</p>
                  <p className="text-[10px]">JPG, PNG, WebP</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Presets Tab */}
        {activeTab === 'presets' && (
          <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto">
            {(type === 'avatar' ? PRESET_AVATARS : PRESET_COVERS).map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => setPreviewUrl(item.url)}
                className={`p-1.5 rounded-xl border text-left transition-colors relative ${
                  previewUrl === item.url
                    ? 'border-[#5B3FD1] bg-[rgba(91,63,209,0.15)]'
                    : 'border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)]'
                }`}
              >
                <img src={item.url} alt={item.name} className="w-full h-16 object-cover rounded-lg" />
                <p className="text-[11px] text-[#F5F2ED] mt-1 truncate">{item.name}</p>
                {previewUrl === item.url && (
                  <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-[#5B3FD1] text-white flex items-center justify-center">
                    <Check className="w-2.5 h-2.5" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* URL Tab */}
        {activeTab === 'url' && (
          <div className="space-y-3">
            <input
              type="url"
              placeholder="https://example.com/photo.jpg"
              value={customUrl}
              onChange={(e) => {
                setCustomUrl(e.target.value);
                setPreviewUrl(e.target.value);
              }}
              className="form-input text-xs"
            />
            {previewUrl && (
              <img src={previewUrl} alt="Preview" className="w-16 h-16 rounded-xl object-cover mx-auto" />
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[rgba(255,255,255,0.08)]">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost text-xs"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!previewUrl && !customUrl}
            onClick={handleApply}
            className="btn btn-primary text-xs"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
};

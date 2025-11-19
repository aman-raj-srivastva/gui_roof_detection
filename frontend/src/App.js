import React, { useState, useRef, useEffect } from 'react';
import './App.css';
import Login from './components/Login';
import axios from 'axios';
import {
  Upload,
  LogOut,
  X,
  Home,
  Zap,
  Download,
} from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
const WS_BASE_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8080';

const Button = ({ children, onClick, variant = 'primary', className = '', icon: Icon, disabled }) => {
  const baseStyle =
    'flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all duration-200 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed';
  const variants = {
    primary:
      'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:from-violet-500 hover:to-indigo-500',
    secondary:
      'bg-white/10 text-white border border-white/20 hover:bg-white/20 backdrop-blur-sm',
    ghost: 'text-indigo-100 hover:text-white hover:bg-white/10',
    danger:
      'bg-rose-500/10 text-rose-200 border border-rose-500/20 hover:bg-rose-500/20',
  };
  return (
    <button
      onClick={onClick}
      className={`${baseStyle} ${variants[variant]} ${className}`}
      disabled={disabled}
    >
      {Icon && <Icon size={18} />}
      {children}
    </button>
  );
};

const buildAssetUrl = (path = '') =>
  path.startsWith('http://') || path.startsWith('https://')
    ? path
    : `${API_BASE_URL}${path}`;

const normalizeSegments = (segmentList = []) =>
  segmentList
    .filter((segment) => segment)
    .map((segment, index) => {
      const url = segment.url || segment.imageUrl;
      return {
        ...segment,
        id: segment.id || `segment-${index + 1}`,
        imageUrl: url ? buildAssetUrl(url) : null,
      };
    });

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [inputImage, setInputImage] = useState(null);
  const [outputImage, setOutputImage] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, uploading, analyzing, complete
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingMessage, setProcessingMessage] = useState('');
  const [resultId, setResultId] = useState(null);
  const [segments, setSegments] = useState([]);
  const [isDownloadingSegments, setIsDownloadingSegments] = useState(false);
  const inputRef = useRef(null);
  const wsRef = useRef(null);

  useEffect(() => {
    let ws;
    try {
      ws = new WebSocket(WS_BASE_URL);
    } catch (error) {
      console.error('Failed to open WebSocket', error);
      return undefined;
    }

    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'upload') {
          setUploadProgress(data.progress || 0);
          setStatus((prev) => (prev === 'idle' ? 'uploading' : prev));
        } else if (data.type === 'processing') {
          setProcessingProgress(data.progress || 0);
          setProcessingMessage(data.message || '');
          setStatus('analyzing');
        } else if (data.type === 'complete') {
          setProcessingProgress(100);
          setProcessingMessage(data.message || 'Processing complete');
          setStatus('complete');
          if (data.resultId) {
            setResultId(data.resultId);
          }
          if (data.resultUrl) {
            setOutputImage(buildAssetUrl(data.resultUrl));
          }
          if (data.inputUrl) {
            setInputImage((prev) => prev ?? buildAssetUrl(data.inputUrl));
          }
          if (data.segments) {
            setSegments(normalizeSegments(data.segments));
          }
        }
      } catch (error) {
        console.error('Invalid WS payload', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const handleLogin = (value) => {
    setIsAuthenticated(true);
    setUsername(value);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUsername('');
    resetApp();
  };

  const handleDrag = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.type === 'dragenter' || event.type === 'dragover') {
      setDragActive(true);
    } else if (event.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
      handleFile(event.dataTransfer.files[0]);
    }
  };

  const handleChange = (event) => {
    event.preventDefault();
    if (event.target.files && event.target.files[0]) {
      handleFile(event.target.files[0]);
    }
  };

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      alert('Please select a valid image file');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setInputImage(reader.result);
    };
    reader.readAsDataURL(file);

    await handleImageUpload(file);
  };

  const handleImageUpload = async (file) => {
    try {
      setStatus('uploading');
      setUploadProgress(0);
      setProcessingProgress(0);
      setProcessingMessage('');
      setOutputImage(null);
      setSegments([]);
      setResultId(null);

      const formData = new FormData();
      formData.append('image', file);

      const response = await axios.post(
        `${API_BASE_URL}/api/upload?username=${encodeURIComponent(username || 'guest')}`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percent = Math.round(
                (progressEvent.loaded * 100) / progressEvent.total
              );
              setUploadProgress(percent);
            }
          },
        }
      );

      const data = response.data || {};

      if (data.resultId) {
        setResultId(data.resultId);
      }
      if (data.resultUrl) {
        setOutputImage(buildAssetUrl(data.resultUrl));
      }
      if (data.segments) {
        setSegments(normalizeSegments(data.segments));
      }
      if (data.inputUrl) {
        setInputImage((prev) => prev || buildAssetUrl(data.inputUrl));
      }

      setUploadProgress(100);
      setProcessingProgress((prev) => (prev >= 100 ? prev : 100));
      setProcessingMessage((prev) => prev || 'Processing complete');
      setStatus('complete');
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload image. Please try again.');
      resetApp();
    }
  };

  const resetApp = () => {
    setInputImage(null);
    setOutputImage(null);
    setStatus('idle');
    setUploadProgress(0);
    setProcessingProgress(0);
    setProcessingMessage('');
    setResultId(null);
    setSegments([]);
    setIsDownloadingSegments(false);
  };

  const handleSaveResults = async () => {
    if (!outputImage) {
      alert('No results to save');
      return;
    }

    const filename = `roof-detection-result-${resultId || Date.now()}.jpg`;
    try {
      const response = await fetch(outputImage);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(anchor);

      if (resultId) {
        try {
          await axios.post(`${API_BASE_URL}/api/save`, {
            resultId,
            inputUrl: inputImage,
            resultUrl: outputImage,
          });
        } catch (error) {
          console.warn('Metadata save failed', error);
        }
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save image. Please try again.');
    }
  };

  const handleDownloadSegments = async () => {
    if (!resultId || segments.length === 0 || isDownloadingSegments) {
      return;
    }

    try {
      setIsDownloadingSegments(true);
      const response = await fetch(
        `${API_BASE_URL}/api/results/${resultId}/segments.zip`
      );
      if (!response.ok) {
        throw new Error('Failed to download segments');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `roof-segments-${resultId}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(anchor);
    } catch (error) {
      console.error('Segments download error:', error);
      alert('Failed to download segments. Please try again.');
    } finally {
      setIsDownloadingSegments(false);
    }
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen w-full bg-[#0f172a] relative overflow-hidden font-sans text-slate-200 selection:bg-indigo-500/30">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/20 blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/20 blur-[120px] animate-pulse-slow delay-1000" />
        <div className="absolute top-[20%] right-[20%] w-[30%] h-[30%] rounded-full bg-fuchsia-500/10 blur-[100px]" />
      </div>

      <nav className="relative z-50 w-full max-w-7xl mx-auto px-6 py-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl shadow-lg shadow-indigo-500/20">
            <Home className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">RoofAI</h1>
            <p className="text-xs text-slate-400 font-medium">Architecture Intelligence</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-white/5 rounded-full border border-white/10 backdrop-blur-md">
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-300 to-orange-500 flex items-center justify-center text-white font-bold text-xs shadow-inner">
              {username.charAt(0).toUpperCase()}
            </div>
            <div className="text-sm">
              <p className="text-white font-medium leading-none">{username}</p>
              <span className="text-[10px] text-emerald-400 font-medium uppercase tracking-wider">
                Active
              </span>
            </div>
          </div>
          <Button
            variant="secondary"
            icon={LogOut}
            className="!p-2.5 !rounded-full aspect-square"
            onClick={handleLogout}
          />
        </div>
      </nav>

      <main className="relative z-10 container mx-auto px-4 pt-8 pb-20 max-w-5xl">
        <div className="text-center mb-12 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium mb-2">
            <Zap size={12} className="fill-indigo-300" />
            Powered by YOLOv11 Segmentation
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
            Detect Roofs with{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-fuchsia-400">
              Precision
            </span>
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Upload aerial or satellite imagery. The AI pipeline streams progress via WebSockets,
            segments each structure, and prepares OPA-ready metadata.
          </p>
        </div>

        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-[2.5rem] opacity-30 blur-xl group-hover:opacity-50 transition duration-1000" />

          <div className="relative bg-[#1e293b]/80 backdrop-blur-xl rounded-[2rem] border border-white/10 shadow-2xl overflow-hidden min-h-[520px] flex flex-col">
            {status === 'idle' && (
              <form
                className="flex-1 flex flex-col items-center justify-center p-12 text-center transition-all duration-300"
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
              >
                <input
                  ref={inputRef}
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleChange}
                />
                <div
                  className={`relative w-full max-w-xl aspect-[3/1.5] rounded-3xl border-2 border-dashed flex flex-col items-center justify-center gap-6 transition-all duration-300 cursor-pointer group ${
                    dragActive
                      ? 'border-indigo-400 bg-indigo-500/10 scale-[1.02]'
                      : 'border-slate-600 hover:border-slate-500 hover:bg-slate-800/50'
                  }`}
                >
                  <div
                    className={`p-6 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 shadow-xl shadow-indigo-900/20 transition-transform duration-300 ${
                      dragActive ? 'scale-110 rotate-3' : 'group-hover:scale-105'
                    }`}
                  >
                    <Upload className="text-white" size={40} />
                  </div>

                  <div className="space-y-2">
                    <p className="text-xl font-semibold text-white">
                      Drop your image here, or{' '}
                      <span className="text-indigo-400 underline decoration-indigo-400/30 underline-offset-4">
                        browse
                      </span>
                    </p>
                    <p className="text-slate-400 text-sm">
                      Supports JPG, PNG, WEBP • Max size 50MB
                    </p>
                  </div>
                </div>
              </form>
            )}

            {status !== 'idle' && (
              <div className="flex-1 flex flex-col lg:flex-row">
                <div className="flex-1 bg-black/20 relative group p-4 flex items-center justify-center overflow-hidden">
                  <div className="relative rounded-xl overflow-hidden shadow-2xl max-h-[620px] bg-black/20 min-h-[320px] min-w-full flex items-center justify-center">
                    {inputImage ? (
                      <img
                        src={inputImage}
                        alt="Upload"
                        className="max-w-full h-auto object-contain"
                      />
                    ) : (
                      <p className="text-slate-500">Waiting for upload...</p>
                    )}

                    {status === 'analyzing' && (
                      <div className="absolute inset-0 z-10 border-b-2 border-indigo-500/80 bg-gradient-to-b from-indigo-500/10 to-transparent animate-scan pointer-events-none">
                        <div className="absolute bottom-0 right-2 text-[10px] font-mono text-indigo-300 bg-black/50 px-1 rounded">
                          {processingMessage || 'Processing...'} {processingProgress}%
                        </div>
                      </div>
                    )}

                    {status === 'complete' && outputImage && (
                      <div className="absolute inset-0 z-10 animate-fade-in">
                        <img
                          src={outputImage}
                          alt="Detected Roofs"
                          className="absolute inset-0 w-full h-full object-contain"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="w-full lg:w-96 border-l border-white/10 bg-white/5 backdrop-blur-md p-8 flex flex-col">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        {status === 'analyzing'
                          ? 'Analyzing...'
                          : status === 'uploading'
                          ? 'Uploading...'
                          : 'Detection Results'}
                      </h3>
                      <p className="text-sm text-slate-400 mt-1">
                        ID: #RF-{resultId || 'pending'}
                      </p>
                    </div>
                    <button
                      onClick={resetApp}
                      className="p-2 hover:bg-white/10 rounded-full transition-colors text-slate-400 hover:text-white"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {(status === 'uploading' || status === 'analyzing') && (
                    <div className="flex-1 flex flex-col items-center justify-center space-y-6">
                      <div className="relative w-24 h-24">
                        <svg className="w-full h-full -rotate-90">
                          <circle
                            cx="48"
                            cy="48"
                            r="40"
                            stroke="currentColor"
                            strokeWidth="6"
                            fill="transparent"
                            className="text-slate-700"
                          />
                          <circle
                            cx="48"
                            cy="48"
                            r="40"
                            stroke="currentColor"
                            strokeWidth="6"
                            fill="transparent"
                            className="text-indigo-500 transition-all duration-300 ease-linear"
                            strokeDasharray={251.2}
                            strokeDashoffset={
                              251.2 -
                              (251.2 * (status === 'uploading' ? uploadProgress : processingProgress)) /
                                100
                            }
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center font-bold text-xl text-white">
                          {status === 'uploading' ? uploadProgress : processingProgress}%
                        </div>
                      </div>
                      <div className="text-center space-y-2">
                        <p className="text-white font-medium">
                          {status === 'uploading' ? 'Uploading Image' : 'Segmenting Structures'}
                        </p>
                        <p className="text-sm text-slate-400">
                          {status === 'uploading'
                            ? 'Sending to server...'
                            : processingMessage || 'Running YOLOv11 inference...'}
                        </p>
                      </div>
                    </div>
                  )}

                  {status === 'complete' && (
                    <div className="flex-1 space-y-6 animate-slide-up">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                          <p className="text-slate-400 text-xs uppercase font-semibold tracking-wider mb-1">
                            Confidence
                          </p>
                          <p className="text-2xl font-bold text-emerald-400">
                            {segments.length > 0 && segments[0].confidence
                              ? `${(segments[0].confidence * 100).toFixed(1)}%`
                              : '99.4%'}
                          </p>
                        </div>
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                          <p className="text-slate-400 text-xs uppercase font-semibold tracking-wider mb-1">
                            Detections
                          </p>
                          <p className="text-2xl font-bold text-white">
                            {segments.length || (outputImage ? 1 : 0)}
                          </p>
                        </div>
                      </div>

                      {segments.length > 0 && (
                        <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                          {segments.slice(0, 3).map((segment, idx) => (
                            <div
                              key={segment.id}
                              className={`p-4 ${
                                idx < Math.min(segments.length, 3) - 1 ? 'border-b border-white/10' : ''
                              } flex justify-between items-center`}
                            >
                              <span className="text-slate-300">{segment.className || `Roof ${idx + 1}`}</span>
                              <span className="font-medium text-white flex items-center gap-2">
                                {segment.confidence
                                  ? `${(segment.confidence * 100).toFixed(0)}%`
                                  : 'Detected'}
                                {segment.bbox && (
                                  <span className="text-xs text-slate-400 font-mono">
                                    {segment.bbox.join(', ')}
                                  </span>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="pt-4 space-y-3">
                        <Button className="w-full" variant="primary" onClick={handleSaveResults} icon={Download}>
                          Download Report
                        </Button>
                        <Button onClick={resetApp} className="w-full" variant="ghost">
                          Analyze Another Image
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-indigo-500 rounded-b-[2rem] opacity-50" />
        </div>

        {segments.length > 0 && (
          <section className="mt-12 bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-xl shadow-2xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <h3 className="text-2xl font-semibold text-white flex items-center gap-3">
                  Detected Segments
                  <span className="text-sm font-medium text-indigo-300 bg-indigo-500/10 px-3 py-1 rounded-full">
                    {segments.length} regions
                  </span>
                </h3>
                <p className="text-slate-400">
                  Each tile can be exported for downstream OPA/OPAL authorization flows.
                </p>
              </div>
              <Button
                variant="primary"
                onClick={handleDownloadSegments}
                disabled={isDownloadingSegments}
                className="w-full md:w-auto"
                icon={Download}
              >
                {isDownloadingSegments ? 'Preparing Zip...' : 'Download Segments'}
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {segments.map((segment) => (
                <div
                  key={segment.id}
                  className="bg-[#0f172a]/60 border border-white/10 rounded-2xl overflow-hidden shadow-lg"
                >
                  <div className="bg-black/30 aspect-video flex items-center justify-center">
                    {segment.imageUrl ? (
                      <img
                        src={segment.imageUrl}
                        alt={segment.className || 'Segment'}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <p className="text-slate-500 text-sm">No preview available</p>
                    )}
                  </div>
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-lg font-semibold text-white">
                        {segment.className || 'Roof Segment'}
                      </p>
                      {segment.confidence && (
                        <span className="text-emerald-300 text-sm font-semibold">
                          {(segment.confidence * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>
                    {segment.bbox && (
                      <div className="text-xs text-slate-400 font-mono">
                        BBox: {segment.bbox.join(', ')}
                      </div>
                    )}
                    {segment.area !== undefined && segment.area !== null && (
                      <p className="text-sm text-slate-400">
                        Area: {Number(segment.area).toFixed(2)} m²
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="relative z-10 text-center text-slate-500 text-sm pb-8">
        <p>© 2025 RoofAI Solutions. All rights reserved.</p>
      </footer>
    </div>
  );
}



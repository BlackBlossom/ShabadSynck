import { useState, useRef } from "react";
import { Dialog } from "@headlessui/react";
import { CloudArrowUpIcon } from "@heroicons/react/24/outline";

export default function ImportLyricsModal({ open, onClose, onImport }) {
  const [fileName, setFileName] = useState(null);
  const [fileContent, setFileContent] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const inputRef = useRef(null);

  const handleFiles = async (files) => {
    if (!files.length) return;
    
    const file = files[0];
    setFileName(file.name);
    setSelectedFile(file);
    
    // Read file content for preview
    try {
      const text = await file.text();
      setFileContent(text);
    } catch (error) {
      console.error('Error reading file:', error);
      setFileContent('Error reading file content');
    }
  };

  const handleConfirmImport = () => {
    if (selectedFile) {
      onImport && onImport(selectedFile);
      // Reset state
      setFileName(null);
      setFileContent(null);
      setSelectedFile(null);
      onClose();
    }
  };

  const handleCancel = () => {
    setFileName(null);
    setFileContent(null);
    setSelectedFile(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-2xl rounded-xl bg-[#1A1A1A] p-8 shadow-xl max-h-[80vh] overflow-y-auto">
          <Dialog.Title className="mb-4 text-xl font-semibold text-center">
            Import Lyrics
          </Dialog.Title>

          {!selectedFile ? (
            // File selection area
            <div
              onClick={() => inputRef.current.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFiles(e.dataTransfer.files);
              }}
              className="group flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#1DB954]/60 bg-[#121212] p-8 text-[#B3B3B3] hover:border-[#1DB954]/90 cursor-pointer transition"
            >
              <CloudArrowUpIcon className="h-12 w-12 text-[#1DB954]" />
              <p className="mt-3 text-center">
                Click or drop .lrc / .txt file here
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Supported formats: LRC (with timestamps) or plain text
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".lrc,.txt"
                className="hidden"
                onChange={(e) => handleFiles(e.target.files)}
              />
            </div>
          ) : (
            // File preview and confirmation area
            <div className="space-y-4">
              <div className="bg-[#121212] rounded-lg p-4 border border-[#1DB954]/30">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-[#1DB954]">Selected File</h3>
                  <button
                    onClick={() => {
                      setFileName(null);
                      setFileContent(null);
                      setSelectedFile(null);
                    }}
                    className="text-xs text-gray-400 hover:text-white transition-colors"
                  >
                    Choose Different File
                  </button>
                </div>
                <p className="text-white font-medium">{fileName}</p>
              </div>

              {fileContent && (
                <div className="bg-[#121212] rounded-lg p-4 border border-white/10">
                  <h3 className="text-sm font-medium text-gray-300 mb-3">Preview</h3>
                  <div className="bg-black/30 rounded p-3 max-h-48 overflow-y-auto">
                    <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono">
                      {fileContent.slice(0, 500)}
                      {fileContent.length > 500 && '...'}
                    </pre>
                  </div>
                </div>
              )}

              <div className="flex justify-center space-x-4 pt-4">
                <button
                  onClick={handleCancel}
                  className="px-6 py-2 rounded-full bg-gray-600 hover:bg-gray-500 text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmImport}
                  className="px-6 py-2 rounded-full bg-[#1DB954] hover:brightness-110 text-black font-semibold transition-all"
                >
                  Import Lyrics
                </button>
              </div>
            </div>
          )}

          {!selectedFile && (
            <button
              onClick={handleCancel}
              className="mt-6 w-full rounded-full bg-gray-600 px-6 py-2 font-semibold text-white transition hover:bg-gray-500"
            >
              Close
            </button>
          )}
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}

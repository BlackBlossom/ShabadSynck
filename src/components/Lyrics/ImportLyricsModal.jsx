import { useState, useRef } from "react";
import { Dialog } from "@headlessui/react";
import { CloudArrowUpIcon } from "@heroicons/react/24/outline";

export default function ImportLyricsModal({ open, onClose, onImport }) {
  const [fileName, setFileName] = useState(null);
  const inputRef = useRef(null);

  const handleFiles = (files) => {
    if (!files.length) return;
    setFileName(files[0].name);
    onImport && onImport(files[0]);        // pass file up
  };

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-md rounded-xl bg-[#1A1A1A] p-8 text-center shadow-xl">
          <Dialog.Title className="mb-4 text-xl font-semibold">
            Import Lyrics
          </Dialog.Title>

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
            <p className="mt-3">
              {fileName ?? "Click or drop .lrc / .txt file here"}
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".lrc,.txt"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          <button
            onClick={onClose}
            className="mt-6 rounded-full bg-[#1DB954] px-6 py-2 font-semibold text-black/90 transition hover:brightness-110"
          >
            Close
          </button>
        </Dialog.Panel>
      </div>
    </Dialog>
  );
}

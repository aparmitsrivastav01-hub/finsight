import { useCallback, useRef, useState } from "react";

const ACCEPT =
  ".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export default function FileUpload({
  onFile,
  loading,
  error,
  uploadName,
  hasResults,
  onClear,
}) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);

  const pick = useCallback(() => inputRef.current?.click(), []);

  const onChange = (e) => {
    const f = e.target.files?.[0];
    if (f) onFile(f);
    e.target.value = "";
  };

  const validateAndSend = (file) => {
    onFile(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) validateAndSend(f);
  };

  return (
    <div className="max-w-xl mx-auto">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            pick();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        onClick={pick}
        className={[
          "relative rounded-2xl border-2 border-dashed px-6 py-12 text-center cursor-pointer",
          "transition-all duration-300 ease-out",
          drag
            ? "border-sky-400/70 bg-sky-500/10 scale-[1.01]"
            : "border-white/10 bg-white/[0.02] hover:border-sky-500/40 hover:bg-white/[0.04]",
          loading && "pointer-events-none opacity-70",
        ].join(" ")}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={onChange}
          disabled={loading}
        />

        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <Spinner />
            <p className="text-slate-300 text-sm">Processing your file…</p>
          </div>
        ) : (
          <>
            <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-gradient-to-br from-sky-500/20 to-emerald-500/20 flex items-center justify-center border border-white/10">
              <UploadIcon />
            </div>
            <p className="text-white font-medium">Drop your CSV here</p>
            <p className="text-slate-500 text-sm mt-1">or click to browse · Category, Item, Amount</p>
          </>
        )}
      </div>

      {error && (
        <div
          className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200 animate-fade-in"
          role="alert"
        >
          {error}
        </div>
      )}

      {uploadName && !loading && !error && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-sm animate-fade-in">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 text-emerald-300 px-3 py-1 border border-emerald-500/25">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Uploaded: {uploadName}
          </span>
          {hasResults && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="text-slate-400 hover:text-white underline-offset-2 hover:underline transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div
      className="h-10 w-10 rounded-full border-2 border-sky-500/30 border-t-sky-400 animate-spin"
      aria-hidden
    />
  );
}

function UploadIcon() {
  return (
    <svg className="w-6 h-6 text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
      />
    </svg>
  );
}

import { useCallback, useState } from "react";
import Navbar from "./components/Navbar.jsx";
import FileUpload from "./components/FileUpload.jsx";
import Dashboard from "./components/Dashboard.jsx";
import { PRODUCT_LINE, TAGLINE } from "./constants.js";


const API_BASE = "https://finsight-backend-6sik.onrender.com";

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadName, setUploadName] = useState(null);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setUploadName(null);
  }, []);

  const handleFile = async (file) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    const isCsv = name.endsWith(".csv");
    const isXlsx = name.endsWith(".xlsx");
    if (!isCsv && !isXlsx) {
      setError("Only CSV or XLSX files are supported");
      return;
    }
    setError(null);
    setLoading(true);
    setData(null);
    setUploadName(file.name);

    const form = new FormData();
    form.append("file", file);

    const path = isXlsx ? "/upload/xlsx" : "/upload";

    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        body: form,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error || `Request failed (${res.status})`);
        setData(null);
        return;
      }
      setData(json);
    } catch (e) {
      setError(e.message || "Network error. Is the backend running?");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <header className="text-center mb-10 sm:mb-14 animate-fade-in">
          <h1 className="font-display text-3xl sm:text-5xl font-semibold text-white tracking-tight">
            FINSIGHT
          </h1>
          <p className="mt-3 text-lg sm:text-xl text-slate-300 font-medium max-w-2xl mx-auto leading-snug">
            {TAGLINE}
          </p>
          <p className="mt-4 text-slate-500 max-w-xl mx-auto text-sm sm:text-base">
            Upload a CSV with Category, Item, and Amount. We validate the balance-sheet identity,
            surface ratios, and score structural health using transparent rules.
          </p>
        </header>

        <FileUpload
          onFile={handleFile}
          loading={loading}
          error={error}
          uploadName={uploadName}
          hasResults={Boolean(data)}
          onClear={reset}
        />

        <section className="mt-12 sm:mt-16">
          <Dashboard data={data} loading={loading} error={error} />
        </section>
      </main>

      <footer className="border-t border-white/5 py-6 text-center text-xs text-slate-500 px-4">
        {PRODUCT_LINE}
      </footer>
    </div>
  );
}

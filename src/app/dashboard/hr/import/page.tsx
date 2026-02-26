"use client";

import { useState, useCallback, useRef } from "react";
import Papa from "papaparse";
import { Upload, FileSpreadsheet, Download, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImportError {
  row: number;
  field: string;
  message: string;
}

interface ImportResult {
  created: number;
  updated: number;
  errors: ImportError[];
}

interface CsvRow {
  email?: string;
  name?: string;
  grade?: string;
  tenure_months?: string;
  location?: string;
  legal_entity?: string;
  [key: string]: string | undefined;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CSV_TEMPLATE_HEADERS = [
  "email",
  "name",
  "grade",
  "tenure_months",
  "location",
  "legal_entity",
];

function downloadTemplate() {
  const exampleRows = [
    [
      "ivanov@company.ru",
      "Иванов Иван Иванович",
      "Senior",
      "36",
      "Москва",
      'ООО "Компания"',
    ],
    [
      "petrova@company.ru",
      "Петрова Анна Сергеевна",
      "Middle",
      "18",
      "Санкт-Петербург",
      'ООО "Компания"',
    ],
  ];

  const csvContent = [
    CSV_TEMPLATE_HEADERS.join(","),
    ...exampleRows.map((row) => row.map((v) => `"${v}"`).join(",")),
  ].join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "employees_template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CsvRow[]>([]);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // --- File handling ---

  const handleFile = useCallback((f: File) => {
    if (!f.name.endsWith(".csv")) {
      setError("Допустимы только файлы .csv");
      return;
    }

    setFile(f);
    setResult(null);
    setError(null);

    // Parse for preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = Papa.parse<CsvRow>(text, {
        header: true,
        skipEmptyLines: true,
        preview: 5,
        transformHeader: (h: string) => h.trim().toLowerCase(),
      });

      if (parsed.data.length > 0) {
        setPreviewHeaders(parsed.meta.fields || []);
        setPreview(parsed.data);
      }
    };
    reader.readAsText(f);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFile(e.dataTransfer.files[0]);
      }
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFile(e.target.files[0]);
      }
    },
    [handleFile]
  );

  // --- Import ---

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/import/employees", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error?.message || `HTTP ${res.status}`);
      }

      setResult(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка импорта");
    } finally {
      setImporting(false);
    }
  };

  // --- Reset ---

  const handleReset = () => {
    setFile(null);
    setPreview([]);
    setPreviewHeaders([]);
    setResult(null);
    setError(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  return (
    <div className="page-transition space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-bold">Импорт сотрудников</h1>
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="size-4" />
          Скачать шаблон
        </Button>
      </div>

      {/* --- Upload Zone --- */}
      <Card>
        <CardContent>
          <div
            className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
              dragActive
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/50"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              className="absolute inset-0 cursor-pointer opacity-0"
              onChange={handleInputChange}
            />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileSpreadsheet className="size-10 text-primary" />
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(1)} КБ
                </p>
                <Button variant="ghost" size="sm" onClick={handleReset}>
                  Выбрать другой файл
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="size-10 text-muted-foreground" />
                <p className="text-sm font-medium">
                  Перетащите CSV файл или нажмите для выбора
                </p>
                <p className="text-xs text-muted-foreground">
                  Максимум 1000 строк. Колонки: email, name, grade,
                  tenure_months, location, legal_entity
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* --- Preview --- */}
      {preview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Предпросмотр (первые 5 строк)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {previewHeaders.map((h) => (
                      <TableHead key={h}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((row, i) => (
                    <TableRow key={i}>
                      {previewHeaders.map((h) => (
                        <TableCell key={h}>{row[h] ?? ""}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex justify-end">
              <Button onClick={handleImport} disabled={importing}>
                {importing ? "Импортируем..." : "Импортировать"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* --- Error --- */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-error-light px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* --- Results --- */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Результат импорта</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-2 rounded-lg border border-success/50 bg-success-light px-4 py-3 text-sm">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
              <span>
                Создано: <strong>{result.created}</strong>, Обновлено:{" "}
                <strong>{result.updated}</strong>
              </span>
            </div>

            {result.errors.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-destructive">
                  Ошибки ({result.errors.length}):
                </p>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Строка</TableHead>
                        <TableHead>Поле</TableHead>
                        <TableHead>Ошибка</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.errors.map((err, i) => (
                        <TableRow key={i}>
                          <TableCell className="tabular-nums">
                            {err.row}
                          </TableCell>
                          <TableCell>{err.field}</TableCell>
                          <TableCell className="text-destructive">
                            {err.message}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

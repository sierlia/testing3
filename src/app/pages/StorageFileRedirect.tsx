import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { Navigation } from "../components/Navigation";
import { signedStorageUrl } from "../utils/privateStorage";

const allowedBuckets = new Set(["simulation-pdfs"]);

export function StorageFileRedirect() {
  const [searchParams] = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const bucket = searchParams.get("bucket") ?? "";
    const path = searchParams.get("path") ?? "";
    if (!allowedBuckets.has(bucket) || !path) {
      setError("This file link is not valid.");
      return;
    }
    signedStorageUrl(bucket, path, 300).then((url) => {
      if (!url) {
        setError("You do not have access to this file or the link has expired.");
        return;
      }
      window.location.replace(url);
    });
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
          <h1 className="text-lg font-semibold text-gray-900">{error ? "Could not open file" : "Opening file..."}</h1>
          <p className="mt-2 text-sm text-gray-600">{error || "Creating a secure link for this file."}</p>
        </div>
      </main>
    </div>
  );
}

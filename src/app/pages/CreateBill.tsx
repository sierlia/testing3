import { useState } from "react";
import { Navigation } from "../components/Navigation";
import { AlertTriangle, Info, FileText, Send } from "lucide-react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { useNavigate } from "react-router";

export function CreateBill() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: "",
    type: "H.R. Bill",
    legislativeText: "",
    supportingText: "",
    placeHold: false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const billTypes = [
    "H.R. Bill",
    "H.J. Res. (Joint Resolution)",
    "H. Con. Res. (Concurrent Resolution)",
    "H. Res. (Simple Resolution)",
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    const newErrors: Record<string, string> = {};
    if (!formData.title.trim()) newErrors.title = "Title is required";
    if (!formData.legislativeText.trim()) newErrors.legislativeText = "Legislative text is required";
    if (!formData.supportingText.trim()) newErrors.supportingText = "Supporting text is required";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    console.log("Submitting bill:", formData);
    alert("Bill submitted successfully!");
    navigate("/bills");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create New Bill</h1>
          <p className="text-gray-600">
            Draft legislation to be submitted to the clerk's office
          </p>
        </div>

        {/* Warning banner */}
        <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 mb-1">Important: Bill Text is Final</h3>
              <p className="text-sm text-red-800">
                Once submitted, the legislative text <strong>cannot be edited or repealed</strong>. 
                Please review carefully before submitting. You may only withdraw or place a hold on the bill.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Legislative Title */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <label htmlFor="title" className="block text-sm font-semibold text-gray-900 mb-2">
              Legislative Title *
            </label>
            <input
              id="title"
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., An Act to Improve Public Education Funding"
              className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none ${
                errors.title ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.title && (
              <p className="mt-1 text-sm text-red-600">{errors.title}</p>
            )}
          </div>

          {/* Legislative Type */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <label htmlFor="type" className="block text-sm font-semibold text-gray-900 mb-2">
              Legislative Type *
            </label>
            <select
              id="type"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              {billTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* Legislative Text */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Legislative Text *
            </label>
            <p className="text-sm text-gray-600 mb-3">
              The official text of your proposed legislation
            </p>
            <div className={`border rounded-md ${errors.legislativeText ? 'border-red-500' : 'border-gray-300'}`}>
              <ReactQuill
                theme="snow"
                value={formData.legislativeText}
                onChange={(value) => setFormData({ ...formData, legislativeText: value })}
                placeholder="Section 1. Short Title..."
                className="min-h-[300px]"
                modules={{
                  toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    ['clean']
                  ],
                }}
              />
            </div>
            {errors.legislativeText && (
              <p className="mt-1 text-sm text-red-600">{errors.legislativeText}</p>
            )}
          </div>

          {/* Supporting Text */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              Supporting Text *
            </label>
            <p className="text-sm text-gray-600 mb-3">
              Explain the reasoning and purpose behind this legislation
            </p>
            <div className={`border rounded-md ${errors.supportingText ? 'border-red-500' : 'border-gray-300'}`}>
              <ReactQuill
                theme="snow"
                value={formData.supportingText}
                onChange={(value) => setFormData({ ...formData, supportingText: value })}
                placeholder="This bill addresses..."
                className="min-h-[200px]"
                modules={{
                  toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    ['clean']
                  ],
                }}
              />
            </div>
            {errors.supportingText && (
              <p className="mt-1 text-sm text-red-600">{errors.supportingText}</p>
            )}
          </div>

          {/* Place Hold Toggle */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-start gap-4">
              <input
                type="checkbox"
                id="placeHold"
                checked={formData.placeHold}
                onChange={(e) => setFormData({ ...formData, placeHold: e.target.checked })}
                className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <div className="flex-1">
                <label htmlFor="placeHold" className="font-semibold text-gray-900 cursor-pointer">
                  Place hold after submission
                </label>
                <div className="mt-2 flex items-start gap-2 text-sm text-gray-600">
                  <Info className="w-4 h-4 flex-shrink-0 mt-0.5 text-blue-600" />
                  <p>
                    Placing a hold signals to leadership that you do not want this bill to move forward 
                    in the legislative process at this time. The bill will remain in draft status until you 
                    remove the hold. You can toggle this at any time before the bill advances.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Submit button */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => navigate("/bills")}
              className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              <Send className="w-4 h-4" />
              Submit Bill
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

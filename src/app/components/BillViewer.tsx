import { useState } from "react";
import { FileText, BookOpen, User, AlertCircle } from "lucide-react";

interface Bill {
  id: string;
  number: string;
  title: string;
  sponsor: string;
  status: string;
  hasHold: boolean;
  legislativeText: string;
  supportingText: string;
}

interface BillViewerProps {
  bill: Bill;
}

export function BillViewer({ bill }: BillViewerProps) {
  const [activeTab, setActiveTab] = useState<'legislative' | 'supporting' | 'history'>('legislative');

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <span className="font-mono text-lg font-bold">{bill.number}</span>
          {bill.hasHold && (
            <div className="flex items-center gap-1.5 text-sm px-2 py-1 bg-amber-100 text-amber-700 rounded font-medium">
              <AlertCircle className="w-4 h-4" />
              Hold
            </div>
          )}
        </div>
        <h2 className="text-xl font-bold mb-3">{bill.title}</h2>
        <div className="flex items-center gap-2 text-sm text-blue-100">
          <User className="w-4 h-4" />
          <span>Sponsor: {bill.sponsor}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex">
          <button
            onClick={() => setActiveTab('legislative')}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
              activeTab === 'legislative'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            Legislative Text
          </button>
          <button
            onClick={() => setActiveTab('supporting')}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
              activeTab === 'supporting'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Supporting Text
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
              activeTab === 'history'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            History
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 max-h-[500px] overflow-y-auto">
        {activeTab === 'legislative' && (
          <div 
            className="prose max-w-none"
            dangerouslySetInnerHTML={{ __html: bill.legislativeText }}
          />
        )}
        {activeTab === 'supporting' && (
          <div 
            className="prose max-w-none"
            dangerouslySetInnerHTML={{ __html: bill.supportingText }}
          />
        )}
        {activeTab === 'history' && (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-blue-600 rounded-full mt-2" />
              <div>
                <p className="text-sm font-medium text-gray-900">Submitted to {bill.status}</p>
                <p className="text-xs text-gray-500">February 8, 2026</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 bg-gray-300 rounded-full mt-2" />
              <div>
                <p className="text-sm font-medium text-gray-900">Bill drafted</p>
                <p className="text-xs text-gray-500">February 1, 2026</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

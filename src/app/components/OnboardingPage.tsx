import { useState } from "react";
import { Stepper } from "./Stepper";
import { ConstituencyPicker } from "./ConstituencyPicker";
import { PersonalStatementForm } from "./PersonalStatementForm";
import { ConstituencyDescriptionForm } from "./ConstituencyDescriptionForm";
import { PartySelection } from "./PartySelection";
import { ArrowLeft, ArrowRight } from "lucide-react";

interface OnboardingData {
  constituency: string | null;
  personalStatement: string;
  constituencyDescription: string;
  party: string | null;
  newParty?: {
    name: string;
    platform: string;
  };
}

export function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<OnboardingData>({
    constituency: null,
    personalStatement: "",
    constituencyDescription: "",
    party: null,
  });

  const steps = [
    { id: 1, label: "Choose Constituency" },
    { id: 2, label: "Write Personal Statement" },
    { id: 3, label: "Describe Constituency" },
    { id: 4, label: "Choose Party" },
  ];

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.constituency !== null;
      case 2:
        return formData.personalStatement.trim().length > 0;
      case 3:
        return (
          formData.constituencyDescription.trim().length > 0
        );
      case 4:
        return (
          formData.party !== null ||
          formData.newParty !== undefined
        );
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length && canProceed()) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = () => {
    console.log("Submitting onboarding data:", formData);
    alert("Your selections have been submitted and locked!");
    // Here you would typically send data to a backend
  };

  const updateFormData = (
    field: keyof OnboardingData,
    value: any,
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Student Onboarding
          </h1>
          <p className="text-gray-600">
            Complete the following steps to set up your Gavel
            profile
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <Stepper steps={steps} currentStep={currentStep} />
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 min-h-[400px]">
          {currentStep === 1 && (
            <ConstituencyPicker
              selected={formData.constituency}
              onSelect={(constituency) =>
                updateFormData("constituency", constituency)
              }
            />
          )}

          {currentStep === 2 && (
            <PersonalStatementForm
              value={formData.personalStatement}
              onChange={(value) =>
                updateFormData("personalStatement", value)
              }
            />
          )}

          {currentStep === 3 && (
            <ConstituencyDescriptionForm
              value={formData.constituencyDescription}
              onChange={(value) =>
                updateFormData("constituencyDescription", value)
              }
            />
          )}

          {currentStep === 4 && (
            <PartySelection
              selectedParty={formData.party}
              newParty={formData.newParty}
              onSelectParty={(party) =>
                updateFormData("party", party)
              }
              onCreateParty={(party) =>
                updateFormData("newParty", party)
              }
            />
          )}
        </div>

        <div className="flex items-center justify-between mt-6">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          {currentStep < steps.length ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canProceed()}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              Submit Choices
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
import { Check } from "lucide-react";

interface Step {
  id: number;
  label: string;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
}

export function Stepper({ steps, currentStep }: StepperProps) {
  return (
    <div className="w-full py-6">
      <div className="flex items-center justify-between relative">
        {/* Progress line */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 -z-10">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
          />
        </div>

        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = currentStep > stepNumber;
          const isCurrent = currentStep === stepNumber;
          
          return (
            <div key={step.id} className="flex flex-col items-center flex-1">
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm mb-2 transition-colors
                  ${isCompleted ? 'bg-blue-600 text-white' : ''}
                  ${isCurrent ? 'bg-blue-600 text-white ring-4 ring-blue-100' : ''}
                  ${!isCompleted && !isCurrent ? 'bg-white border-2 border-gray-300 text-gray-500' : ''}
                `}
              >
                {isCompleted ? <Check className="w-5 h-5" /> : stepNumber}
              </div>
              <div
                className={`
                  text-sm text-center font-medium max-w-[120px]
                  ${isCurrent ? 'text-gray-900' : 'text-gray-500'}
                `}
              >
                {step.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

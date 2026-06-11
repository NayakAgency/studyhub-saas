import { cn } from '../../lib/utils.js';
import { Check } from 'lucide-react';

export default function Stepper({ steps, currentStep, orientation = 'horizontal' }) {
  if (orientation === 'vertical') {
    return (
      <div className="flex flex-col">
        {steps.map((step, i) => {
          const state = i < currentStep ? 'completed' : i === currentStep ? 'active' : 'upcoming';
          return (
            <div key={i} className="flex gap-4">
              <div className="flex flex-col items-center">
                <StepCircle index={i} state={state} />
                {i < steps.length - 1 && (
                  <div className={cn('w-0.5 flex-1 mt-1 min-h-[24px]', state === 'completed' ? 'bg-primary-500' : 'bg-gray-200')} />
                )}
              </div>
              <div className="pb-6 flex-1">
                <p className={cn('text-sm font-semibold', state === 'active' ? 'text-primary-700' : state === 'completed' ? 'text-gray-700' : 'text-gray-400')}>
                  {step.label}
                </p>
                {step.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-center">
      {steps.map((step, i) => {
        const state = i < currentStep ? 'completed' : i === currentStep ? 'active' : 'upcoming';
        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <StepCircle index={i} state={state} />
              <span className={cn('text-xs font-medium whitespace-nowrap hidden sm:block',
                state === 'active' ? 'text-primary-700' : state === 'completed' ? 'text-gray-600' : 'text-gray-400'
              )}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn('h-0.5 flex-1 mx-2 mb-4', state === 'completed' ? 'bg-primary-500' : 'bg-gray-200')} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StepCircle({ index, state }) {
  return (
    <div className={cn(
      'h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all border-2',
      state === 'completed' && 'bg-primary-600 border-primary-600 text-white',
      state === 'active'    && 'bg-white border-primary-600 text-primary-700',
      state === 'upcoming'  && 'bg-white border-gray-300 text-gray-400',
    )}>
      {state === 'completed' ? <Check className="h-4 w-4" /> : index + 1}
    </div>
  );
}

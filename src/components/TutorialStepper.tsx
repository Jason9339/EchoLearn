"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  details?: string[];
  images?: string[];
  icon?: React.ReactNode;
  highlight?: string;
}

interface TutorialStepperProps {
  steps: TutorialStep[];
}

export default function TutorialStepper({ steps }: TutorialStepperProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const step = steps[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;

  const goToPrevious = () => {
    if (!isFirst) {
      setCurrentStep(currentStep - 1);
      setCurrentImageIndex(0);
    }
  };

  const goToNext = () => {
    if (!isLast) {
      setCurrentStep(currentStep + 1);
      setCurrentImageIndex(0);
    }
  };

  const goToStep = (index: number) => {
    setCurrentStep(index);
    setCurrentImageIndex(0);
  };

  return (
    <div className="w-full">
      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            步驟 {currentStep + 1} / {steps.length}
          </span>
          <span className="text-sm text-gray-500">{step.title}</span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-sky-500 to-sky-600 transition-all duration-300 ease-out"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Step Indicators */}
      <div className="flex justify-center gap-2 mb-6">
        {steps.map((s, index) => (
          <button
            key={s.id}
            onClick={() => goToStep(index)}
            className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-200 ${
              index === currentStep
                ? "border-sky-500 bg-sky-500 text-white scale-110"
                : index < currentStep
                ? "border-sky-500 bg-sky-100 text-sky-600"
                : "border-gray-300 bg-white text-gray-400"
            }`}
            title={s.title}
          >
            {index < currentStep ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              <span className="text-sm font-bold">{index + 1}</span>
            )}
          </button>
        ))}
      </div>

      {/* Main Content Card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-50 to-sky-100 px-6 py-5 border-b border-sky-100">
          <div className="flex items-center gap-3">
            {step.icon && (
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-white shadow-sm border border-sky-100">
                {step.icon}
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-gray-900">{step.title}</h2>
              {step.highlight && (
                <span className="inline-block mt-1 px-2 py-0.5 bg-sky-500 text-white text-xs font-medium rounded-full">
                  {step.highlight}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <p className="text-gray-700 text-lg mb-4">{step.description}</p>

          {/* Details List */}
          {step.details && step.details.length > 0 && (
            <ul className="space-y-2 mb-6">
              {step.details.map((detail, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center mt-0.5">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </span>
                  <span className="text-gray-600">{detail}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Image Carousel */}
          {step.images && step.images.length > 0 && (
            <div className="relative bg-gray-100 rounded-xl overflow-hidden">
              <div className="relative w-full h-64 md:h-80">
                <Image
                  src={step.images[currentImageIndex]}
                  alt={`${step.title} - 圖片 ${currentImageIndex + 1}`}
                  fill
                  sizes="(max-width: 768px) 90vw, 672px"
                  style={{ objectFit: "contain" }}
                  className="transition-opacity duration-300"
                />
              </div>

              {/* Image Navigation */}
              {step.images.length > 1 && (
                <>
                  <button
                    onClick={() =>
                      setCurrentImageIndex(
                        currentImageIndex === 0
                          ? step.images!.length - 1
                          : currentImageIndex - 1
                      )
                    }
                    className="absolute top-1/2 left-2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                    aria-label="上一張圖片"
                  >
                    <ChevronLeftIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() =>
                      setCurrentImageIndex(
                        currentImageIndex === step.images!.length - 1
                          ? 0
                          : currentImageIndex + 1
                      )
                    }
                    className="absolute top-1/2 right-2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                    aria-label="下一張圖片"
                  >
                    <ChevronRightIcon className="w-5 h-5" />
                  </button>

                  {/* Image Dots */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                    {step.images.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentImageIndex(idx)}
                        className={`w-2 h-2 rounded-full transition-all ${
                          idx === currentImageIndex
                            ? "bg-white w-4"
                            : "bg-white/50"
                        }`}
                        aria-label={`前往圖片 ${idx + 1}`}
                        {...(idx === currentImageIndex ? { "aria-current": "true" } : {})}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={goToPrevious}
            disabled={isFirst}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              isFirst
                ? "text-gray-300 cursor-not-allowed"
                : "text-gray-600 hover:bg-gray-200"
            }`}
          >
            <ChevronLeftIcon className="w-5 h-5" />
            上一步
          </button>

          <button
            onClick={goToNext}
            disabled={isLast}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg font-medium transition-colors ${
              isLast
                ? "bg-emerald-500 text-white cursor-not-allowed"
                : "bg-sky-500 text-white hover:bg-sky-600"
            }`}
          >
            {isLast ? (
              <>
                完成
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </>
            ) : (
              <>
                下一步
                <ChevronRightIcon className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

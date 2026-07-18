import * as React from "react"
import { Button } from "./button"
import { JoveoButton } from "./JoveoButton"

export function JoveoButtonExamples() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-[#3D4759]">Joveo Button System</h2>
        <p className="text-sm text-[#3D4759]">
          These are the four standard button variants in the Joveo design system
        </p>
      </div>
      
      <div className="flex flex-wrap gap-4">
        <JoveoButton variant="primary">Primary Button</JoveoButton>
        <JoveoButton variant="secondary">Secondary Button</JoveoButton>
        <JoveoButton variant="tertiary">Tertiary Button</JoveoButton>
        <JoveoButton variant="text">Text Button</JoveoButton>
      </div>
      
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-[#3D4759]">Joveo Button Sizes</h2>
        <p className="text-sm text-[#3D4759]">
          Buttons come in multiple sizes for different contexts
        </p>
      </div>
      
      <div className="flex flex-wrap items-center gap-4">
        <JoveoButton variant="primary" size="sm">Small</JoveoButton>
        <JoveoButton variant="primary" size="default">Default</JoveoButton>
        <JoveoButton variant="primary" size="lg">Large</JoveoButton>
        <JoveoButton variant="primary" size="icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
        </JoveoButton>
      </div>
      
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-[#3D4759]">Joveo Button States</h2>
        <p className="text-sm text-[#3D4759]">
          Buttons have different states to indicate interactivity
        </p>
      </div>
      
      <div className="flex flex-wrap gap-4">
        <JoveoButton variant="primary">Normal</JoveoButton>
        <JoveoButton variant="primary" disabled>Disabled</JoveoButton>
        <JoveoButton variant="primary" className="opacity-80">Hover</JoveoButton>
        <JoveoButton variant="primary" className="ring-2 ring-[#303F9F]/50 ring-offset-2">Focus</JoveoButton>
      </div>

      <div className="border-t border-gray-200 my-4"></div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-[#3D4759]">Default Button System</h2>
        <p className="text-sm text-[#3D4759]">
          Standard shadcn/ui button variants (for non-Joveo contexts)
        </p>
      </div>
      
      <div className="flex flex-wrap gap-4">
        <Button variant="default">Default Button</Button>
        <Button variant="secondary">Secondary Button</Button>
        <Button variant="outline">Outline Button</Button>
        <Button variant="ghost">Ghost Button</Button>
        <Button variant="link">Link Button</Button>
      </div>
    </div>
  )
}

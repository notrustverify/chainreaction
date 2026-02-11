import React from 'react'
import Link from 'next/link'
import { ThemeShifter } from './ThemeShifter'

export function Footer() {
  return (
    <footer className="w-full py-4 px-4 mt-auto ">
      <div className="max-w-4xl mx-auto flex flex-col  sm:flex-row items-center justify-center gap-2 sm:gap-6 text-sm text-footer-text">
        <div className="flex items-center gap-2"> 

          <span className="text-xs ">
            Built by{' '}
          <a 
            href="https://notrustverify.ch"
            target="_blank"
            rel="noopener noreferrer"
            className="text-footer-link hover:text-footer-link-hover underline"
          >
            No Trust Verify
          </a>          
        </span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeShifter />
        </div>
      </div>
    </footer>
  )
}
 
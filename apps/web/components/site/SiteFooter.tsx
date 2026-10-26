import Link from 'next/link';
import { Logo } from './Logo';

export function SiteFooter() {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="space-y-3 md:col-span-2">
          <Logo light />
          <p className="max-w-sm text-sm text-primary-foreground/75">
            Discover the style that is you — personal styling, with a reason behind every suggestion.
          </p>
        </div>
        <nav aria-label="Explore" className="space-y-2 text-sm">
          <p className="font-medium text-accent">Explore</p>
          <Link href="/#how-it-works" className="block text-primary-foreground/80 hover:text-primary-foreground">
            How It Works
          </Link>
          <Link href="/#features" className="block text-primary-foreground/80 hover:text-primary-foreground">
            Features
          </Link>
          <Link href="/#faq" className="block text-primary-foreground/80 hover:text-primary-foreground">
            FAQ
          </Link>
          <Link href="/about" className="block text-primary-foreground/80 hover:text-primary-foreground">
            About
          </Link>
        </nav>
        <nav aria-label="Legal" className="space-y-2 text-sm">
          <p className="font-medium text-accent">Company</p>
          <Link href="/terms" className="block text-primary-foreground/80 hover:text-primary-foreground">
            Terms of Service
          </Link>
          <Link href="/privacy" className="block text-primary-foreground/80 hover:text-primary-foreground">
            Privacy Policy
          </Link>
          <Link href="/contact" className="block text-primary-foreground/80 hover:text-primary-foreground">
            Contact
          </Link>
        </nav>
      </div>
      <div className="border-t border-primary-foreground/15">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-primary-foreground/60 sm:px-6">
          © {new Date().getFullYear()} StyleMe. Photography from Unsplash (see image credits on the About page).
        </p>
      </div>
    </footer>
  );
}

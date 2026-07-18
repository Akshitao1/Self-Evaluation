import Link from "next/link";

export function Footer() {
    return (
        <footer className="mt-auto glass z-50 bg-white">
            <div className="flex flex-col items-center w-full justify-center gap-4 py-6 md:h-12 md:flex-row md:py-0">
                    <p className="text-center font-medium text-sm leading-loose text-[#252F3F]">
                        © {new Date().getFullYear()} <a href="https://www.joveo.com" target="_blank" rel="noopener noreferrer" className="text-[#252F3F] transition-colors hover:text-foreground underline">Joveo.com</a>
                    </p>
                    <Link href=" https://www.joveo.com/privacy-policy/" className="text-sm font-medium text-[#252F3F] transition-colors hover:text-foreground underline">
                    Privacy Policy
                    </Link>
                    <Link href="https://www.joveo.com/terms-of-use" className="text-sm font-medium text-[#252F3F] transition-colors hover:text-foreground underline">
                    Terms of Use
                    </Link>
            </div>
        </footer>
    );
} 